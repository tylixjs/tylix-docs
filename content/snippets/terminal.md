```bash
npm create tylix@latest my-app
cd my-app
tylix make:feature Todo title:string:required done:boolean:default=false
tylix migrate
npm run dev
```
