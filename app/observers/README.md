# Observers

Code that runs when a model is created, updated or deleted: creating/created, updating/updated, deleting/deleted. "creating" and "updating" may return changed data. Enable one with static observers = [UserObserver] in the model. UserObserver queues the welcome email when someone registers.

Command: `tylix make:observer Audit --model User`
