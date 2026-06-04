const { Client } = require('pg');

const passwords = ['postgres', 'root', 'admin', 'password', '123456', 'worksure'];
const users = ['postgres', 'worksure_user'];
const dbs = ['worksure_db', 'postgres', 'worksure_test'];

async function testConnections() {
  for (const db of dbs) {
    for (const user of users) {
      for (const pwd of passwords) {
        const client = new Client({
          user: user,
          host: 'localhost',
          database: db,
          password: pwd,
          port: 5432,
        });

        try {
          await client.connect();
          console.log(`SUCCESS: user=${user}, password=${pwd}, db=${db}`);
          await client.end();
          return;
        } catch (err) {
           console.log(`FAILED: db=${db}, user=${user}, pwd=${pwd} -> ${err.message}`);
        }
      }
    }
  }
}

testConnections();
