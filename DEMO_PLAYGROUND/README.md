IN ORDER FROM SIMPLEST TO MOST COMPLEX DEMOS
Chat assisted exploration
httpdemo -> simple port by port messaging demo with multi-tenant connections and real time updates on the sse server

Started vibe coding here with Astra in chat
reactdemo -> same thing but with a ract front end which allows http submissions, not just console POSTs
ssodemo -> step up from the react demo but with single sign on capabilites from amazon, .env file is .gitignored so testing will be impossible without congito pool ID and others
postgresdemo -> adds persistent storage of user inforamtion and messages so that data survives instances of the application. Must run your own postgres server on port 5432 to test.
pmingdemo -> a step up, using alembic to update messaging to allow for priavte messaging of connected users 
ec2demo -> adds all the dependencies needed to get the applicaton running on our wonderful ec2 instance. adds a script for uploading the current codebase to the cloud as a docker image, utilizes uv and expo for the first time. Also has the added functionality of looking up users by their emails.

Started using codex with Asta here. Vibe code peak reached.
groupdemo -> adds logic to handle group messaging and management of chats. 
applicaiton buildout -> the entire demo application without RSO logic

