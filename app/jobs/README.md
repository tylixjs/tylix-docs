# Jobs

Work that shouldn't make a request wait: emails, exports, webhooks. Each file exports an object with handle(payload).

Command: `tylix make:job SendInvoice`

Queue one: dispatch("SendWelcomeEmail", { userId }) from @tylix/core. Run them: tylix queue:work
