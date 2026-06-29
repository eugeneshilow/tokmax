# Security Policy

We take the security of **tokmax** (the `tokmax` npm CLI, the web app, and the
Convex backend) seriously. Thank you for helping keep it and its users safe.

## Supported versions

Security fixes are released for the latest published version only. Older
versions are not patched — please upgrade before reporting.

| Component                | Supported          |
| ------------------------ | ------------------ |
| `tokmax` CLI (latest)    | :white_check_mark: |
| `tokmax` CLI (older)     | :x:                |
| Web app / backend (prod) | :white_check_mark: |

To get the latest CLI: `npx tokmax@latest` or `npm install -g tokmax@latest`.

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for security
problems.** Public disclosure before a fix puts users at risk.

Report privately through GitHub:

1. Go to the **Security** tab of this repository:
   <https://github.com/eugeneshilow/tokmax/security>
2. Click **Report a vulnerability** to open a private security advisory
   (GitHub Private Vulnerability Reporting is enabled on this repo).

Please include, where possible:

- A description of the issue and its impact.
- Steps to reproduce (proof-of-concept, affected version, environment).
- Any suggested remediation.

## What to expect

- **Acknowledgement:** within 3 business days.
- **Initial assessment / triage:** within 7 business days.
- **Fix & disclosure:** we aim to ship a fix and publish a coordinated advisory
  as quickly as the severity warrants. We will keep you updated on progress and
  credit you in the advisory unless you prefer to remain anonymous.

## Scope notes

- `tokmax` aggregates local usage statistics only. It never transmits your
  prompts, source files, or API keys. Reports about the tool exfiltrating such
  data are treated as critical.
- Please test against your own accounts/data only. Do not run attacks that
  degrade service for other users (DoS), and do not access data that is not
  yours.

Thank you for practicing responsible disclosure.
