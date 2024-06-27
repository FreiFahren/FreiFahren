#!/bin/bash

# Source the environment file
source /root/FreiFahren/packages/.crash_env

# here, we check if the environment varibal IS_PUSH is set to 1, if yes, a github action was runned and something was pushed. so we don't send an email.
if [ "$IS_PUSH" -eq 1 ]
then
    echo "IS_PUSH is set to 1, not sending email."
else
    curl -s \
            -X POST \
            --user "63e07d737e864ded36c1d2389f3d3b68:d9472a980a0c1fbd572294f83248237e" \
            https://api.mailjet.com/v3.1/send \
            -H 'Content-Type: application/json' \
            -d '{
                    "Messages":[
                                    {
                                                    "From": {
                                                                    "Email": "freifahren@freifahren.org",
                                                                    "Name": "Freifahren"
                                                    },
                                                    "To": [
                                                                    {
                                                                                    "Email": "dbrandesx@gmail.com",
                                                                                    "Name": "David Brandes"
                                                                    },
                                    {
                                                                                    "Email": "johan@trieloff.net",
                                                                                    "Name": "Johan Trieloff"
                                                                    }
                                                    ],
                                                    "Subject": "Der Bot und Watcher ist down!",
                                                    "TextPart": "Hilfe! Der Bot und Watcher ist down!",
                                                    "HTMLPart": "<h3>Hilfe! Der Bot und Watcher ist down!</h3>"
                                    }
                    ]
            }'

