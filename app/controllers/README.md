# Controllers

Classes whose methods handle requests: read req.params / req.query / req.body, call models or services, and answer with res.json(...) or res.status(code).json(...).

Command: `tylix make:controller Invoice`

Wire them to URLs in app/routes/web.ts.
