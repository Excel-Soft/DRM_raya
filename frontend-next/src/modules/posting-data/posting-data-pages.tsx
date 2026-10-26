"use client";

import { PostingDataCore } from "@/modules/posting-data/posting-data-core";
import { PostingDataShell } from "@/modules/posting-data/posting-data-ui";

export function AddProductsPage() {
  return (
    <PostingDataShell title="Add products" description="Upload and register product posting data by category.">
      <PostingDataCore screen="add-products" />
    </PostingDataShell>
  );
}

export function AddKeywordsPage() {
  return (
    <PostingDataShell title="Add keywords" description="Create keyword records and import CSV batches.">
      <PostingDataCore screen="add-keywords" />
    </PostingDataShell>
  );
}

export function ViewKeywordsPage() {
  return (
    <PostingDataShell title="View keywords" description="Browse and filter keyword posting records.">
      <PostingDataCore screen="view-keywords" />
    </PostingDataShell>
  );
}

export function ViewProductsPage() {
  return (
    <PostingDataShell title="View products" description="Browse product cards by category.">
      <PostingDataCore screen="view-products" />
    </PostingDataShell>
  );
}

export function DataVerifyPage() {
  return (
    <PostingDataShell title="Data verify" description="Approve pending posting records.">
      <PostingDataCore screen="data-verify" />
    </PostingDataShell>
  );
}

export function RestrictedKeywordsPage() {
  return (
    <PostingDataShell title="Restricted keywords" description="Maintain the restricted keyword list.">
      <PostingDataCore screen="restricted-keywords" />
    </PostingDataShell>
  );
}
