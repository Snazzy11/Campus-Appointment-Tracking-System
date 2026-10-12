IN ORDER FROM SIMPLEST TO MOST COMPLEX DEMOS
httpdemo -> simple port by port messaging demo with multi-tenant connections and real time updates on the sse server
reactdemo -> same thing but with a ract front end which allows http submissions, not just console POSTs
ssodemo -> step up from the react demo but with single sign on capabilites from amazon, .env file is .gitignored so testing will be impossible without congito pool ID and others
postgresdemo -> adds persistent storage of user inforamtion and messages so that data survives instances of the application. Must run your own postgres server on port 5432 to test.
pmingdemo -> a step up, using alembic to update messaging to allow for priavte messaging of connected users 
