# Validators

Rules for incoming data, e.g. validate(req.body, { title: [required, isString] }) from @tylix/shared. Controllers answer 422 with the errors.

Command: `tylix make:validator Invoice title:string total:number`
