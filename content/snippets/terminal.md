```bash
npm create tylix@latest my-app
cd my-app
npx tylix make:feature Todo title:string:required done:boolean:default=false
npx tylix migrate
npm run dev
```
