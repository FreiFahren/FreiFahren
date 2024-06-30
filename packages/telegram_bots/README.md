# Overview

This is a folder containing the code for the Telegram bots used in the FreiFahren project. The NLP Bot is being used to process the messages being sent by the users to collect the data about the ticket inspectors. The watcher bot is being used to monitor the status of the services (NLP Bot and the backend) and to send the notifications to the users if any of the services are down.

To run the bots you should run the following command from the root of the packages folder:

```bash
python3 -m telegram_bots.watcher.watcher
```

This will start the watcher bot which will start the NLP bot as a sub process.