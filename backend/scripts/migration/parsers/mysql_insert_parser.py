#!/usr/bin/env python3
"""
Character-level parser for phpMyAdmin MariaDB INSERT statements.
Not regex-based row splitting — handles escaped strings, NULL, hex, numbers.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator, Optional


@dataclass
class InsertStatement:
    table: str
    columns: list[str]
    rows: list[tuple[Optional[str], ...]]


class ParseError(Exception):
    pass


def _skip_ws(s: str, i: int) -> int:
    while i < len(s) and s[i] in " \t\r\n":
        i += 1
    return i


def _read_ident_backtick(s: str, i: int) -> tuple[str, int]:
    if s[i] != "`":
        raise ParseError("expected backtick identifier")
    i += 1
    start = i
    while i < len(s) and s[i] != "`":
        i += 1
    if i >= len(s):
        raise ParseError("unterminated backtick ident")
    name = s[start:i]
    i += 1
    return name, i


def _read_value(s: str, i: int) -> tuple[Optional[str], int]:
    i = _skip_ws(s, i)
    if i >= len(s):
        raise ParseError("unexpected end reading value")

    # NULL
    if s[i : i + 4].upper() == "NULL" and (i + 4 >= len(s) or s[i + 4] in ",)"):
        return None, i + 4

    # hex blob 0x...
    if s[i : i + 2].lower() == "0x":
        j = i + 2
        while j < len(s) and s[j] in "0123456789abcdefABCDEF":
            j += 1
        return s[i:j], j

    # quoted string
    if s[i] == "'":
        i += 1
        out: list[str] = []
        while i < len(s):
            c = s[i]
            if c == "'":
                if i + 1 < len(s) and s[i + 1] == "'":
                    out.append("'")
                    i += 2
                    continue
                i += 1
                break
            if c == "\\" and i + 1 < len(s):
                n = s[i + 1]
                mapping = {
                    "0": "\0",
                    "b": "\b",
                    "n": "\n",
                    "r": "\r",
                    "t": "\t",
                    "Z": "\x1a",
                    "'": "'",
                    '"': '"',
                    "\\": "\\",
                }
                out.append(mapping.get(n, n))
                i += 2
                continue
            out.append(c)
            i += 1
        else:
            raise ParseError("unterminated string")
        return "".join(out), i

    # bare number or expression fragment (rare in dumps)
    j = i
    while j < len(s) and s[j] not in ",)":
        j += 1
    token = s[i:j].strip()
    return token, j


def _read_row(s: str, i: int) -> tuple[tuple[Optional[str], ...], int]:
    i = _skip_ws(s, i)
    if s[i] != "(":
        raise ParseError("expected (")
    i += 1
    values: list[Optional[str]] = []
    while True:
        i = _skip_ws(s, i)
        if i < len(s) and s[i] == ")":
            return tuple(values), i + 1
        val, i = _read_value(s, i)
        values.append(val)
        i = _skip_ws(s, i)
        if i < len(s) and s[i] == ",":
            i += 1
            continue
        if i < len(s) and s[i] == ")":
            return tuple(values), i + 1
        raise ParseError("expected , or ) in row")


def parse_insert_statement(sql: str) -> InsertStatement:
    s = sql.strip()
    if not s.endswith(";"):
        s = s + ";"
    i = 0
    i = _skip_ws(s, i)
    if not s[i:].upper().startswith("INSERT"):
        raise ParseError("not an INSERT")
    iu = s.upper()
    pos = iu.find("INTO", i)
    if pos < 0:
        raise ParseError("INSERT missing INTO")
    i = pos + 4
    i = _skip_ws(s, i)
    table, i = _read_ident_backtick(s, i)
    i = _skip_ws(s, i)
    if s[i] != "(":
        raise ParseError("expected column list")
    columns: list[str] = []
    i += 1
    while True:
        i = _skip_ws(s, i)
        if s[i] == ")":
            i += 1
            break
        col, i = _read_ident_backtick(s, i)
        columns.append(col)
        i = _skip_ws(s, i)
        if s[i] == ",":
            i += 1
            continue
        if s[i] == ")":
            i += 1
            break
        raise ParseError("column list parse error")

    i = _skip_ws(s, i)
    if not s[i:].upper().startswith("VALUES"):
        raise ParseError("missing VALUES")
    i += 6
    rows: list[tuple[Optional[str], ...]] = []
    while True:
        i = _skip_ws(s, i)
        if i >= len(s) or s[i] == ";":
            break
        row, i = _read_row(s, i)
        rows.append(row)
        i = _skip_ws(s, i)
        if i < len(s) and s[i] == ",":
            i += 1
            continue
        if i < len(s) and s[i] == ";":
            break
    return InsertStatement(table=table, columns=columns, rows=rows)


def iter_insert_statements_from_stream(path: str) -> Iterator[tuple[int, InsertStatement]]:
    """Yield (start_line_no, parsed insert) streaming the dump file."""
    buf: list[str] = []
    in_insert = False
    start_line = 0
    line_no = 0
    with open(path, "r", encoding="utf-8", errors="strict") as f:
        while True:
            line = f.readline()
            if not line:
                break
            line_no += 1
            stripped = line.lstrip()
            if not in_insert:
                if stripped.upper().startswith("INSERT INTO"):
                    in_insert = True
                    start_line = line_no
                    buf = [line]
                    if stripped.rstrip().endswith(";"):
                        chunk = "".join(buf)
                        yield start_line, parse_insert_statement(chunk)
                        in_insert = False
                        buf = []
                continue
            buf.append(line)
            if stripped.rstrip().endswith(";"):
                chunk = "".join(buf)
                yield start_line, parse_insert_statement(chunk)
                in_insert = False
                buf = []
