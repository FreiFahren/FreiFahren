## Pull request previews

Open the deployment link on the pull request. To review another city, add its slug to the URL, for example `?city=hamburg`.

The preview submits reports to the PR's own API and city databases. Later frontend pushes preserve reports entered during review. Changes to database initialization inputs rebuild the databases and load a fresh sample of recent reports.
