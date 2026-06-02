$ErrorActionPreference = "Continue"
npm run build 2>&1 | Out-File -FilePath "C:\WebExcelsDRM\build_error.log" -Encoding utf8
