# New Freifahren backend using Hono + Drizzle

## Start containers

You can start the DB and bun container like so:

```sh
just up
```

Hot reloading is enabled and the API container should reload any code changes automatically.

When modifying dependencies, or when something breaks in a weird way in general, try rebuilding the containers:

```sh
just rebuild
```

On the first run, you will also have to initialize the DB with

```sh
just db-migrate
```

Once this is done, the API should be available on `localhost:80`.

You might want to populate the DB with stations and lines. Simply run

```sh
just db-seed
```

To populate it with data about Berlin's public transit system.

## DB Migrations

After altering the DB schema, you need to align the actual DB state with the drizzle schema. You first create the migration:

```sh
just db-generate # Generate migration
```

And then apply it to the DB:

```sh
just db-migrate
```

## DB Access / Drizzle Studio

Drizzle provides it's own UI to interact with the DB. Simply run `just db-studio` and open the link you get in your browser.

If you want to access the DB with something like Postico, use the following connection string: `postgres://postgres:postgres@localhost:5432/freifahren`

## API Documentation

The rewrite backend now exposes OpenAPI docs and an interactive Scalar UI.

- Interactive docs: `http://localhost:3000/docs`

The docs are generated from route-level metadata in the rewrite endpoint definitions.
