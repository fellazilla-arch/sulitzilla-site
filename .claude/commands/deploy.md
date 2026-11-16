---
description: Deploy sulitzilla.com through GitHub Actions
---

A push to `main` deploys the live site. Do not ssh from this Mac.

1. Commit only the files for this change. Never stage `server/.env`.
2. `git push origin main`.
3. Tell Dru the deploy was triggered and link `https://github.com/fellazilla-arch/sulitzilla-site/actions`.
4. Live site: **https://sulitzilla.com**

Do not create Asana tasks. A price-list change still follows `/price-change` in the monitor.
