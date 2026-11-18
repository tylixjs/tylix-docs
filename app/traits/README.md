# Traits

Reusable model behaviour, mixed in with use(): class Post extends use(Model, Searchable({ fields: ["title"] })). A trait is a function that takes a model class and returns a subclass of it.

Command: `tylix make:trait HasSlug`

Searchable comes with @tylix/orm and adds Model.search(term).
