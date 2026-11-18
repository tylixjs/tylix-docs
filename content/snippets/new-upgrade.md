```bash
# Every @tylix package shares one version
npm install @tylix/cli@^2.1.1 @tylix/core@^2.1.1 @tylix/compiler@^2.1.1 \
  @tylix/orm@^2.1.1 @tylix/auth@^2.1.1 @tylix/shared@^2.1.1

# Then add what you want from 2.1
tylix make:permissions   # roles, an admin page at /admin/access
tylix make:pwa           # installable, with an offline page
```
