const Q = require('q');
const mysql = require('mysql');
const fs = require('fs');

/**
* @summary Contains methods to setup database for test
*     requires user `gbbb_test`@`localhost`
*     to have access to `good_bot_bad_bot_test` database
*     Makes use of the Q promise library https://github.com/kriskowal/q
* @returns No return value
* */
class DB {
  /**
  * @summary Constructs database helper, loads sql structure.
  * @returns No return value
  * */
  constructor() {
    this.con = null;
    this.tables = [];

    // Appends to setup statement to skip foreign key checks in test
    const setupSQL = fs.readFileSync('public/setup.sql').toString();
    this.sql = setupSQL + '\nSET foreign_key_checks = 0;';
  }

  /**
  * @summary Connects to local test database as `this.con`, allows
  *     multi-statement queries to support bulk insert of db structure.
  * @returns No return value
  * */
  connect() {
    this.con = mysql.createConnection({
      host               :       'localhost',
      user               :       'gbbb_test',
      password           :       '',
      database           :       'good_bot_bad_bot_test',
      multipleStatements :       true
    });
  }

  /**
  * @summary Closes connection to MySQL
  * @returns No return value
  * */
  destroy() {
    this.con.destroy();
  }

  /**
  * @summary Wraps Node-MySQL's query method in a promise using the Q library.
  * @param {string} Query string to be supplied to query method
  * @param {array|optional} Array of values to be interpolated in to the queryString.
  *     See https://github.com/mysqljs/mysql#escaping-query-values.
  * @returns Returns promise
  * */
  query(queryString, fields = []) {
    return Q.Promise((resolve, reject) => {
      this.con.query(queryString, fields,
        (err, results) => {
          if(!!err) {
            return reject(new Error(err));
          }
          resolve(results);
        });
      });
  }

  /**
  * @summary Creates test database
  * @returns Returns promise
  * */
  createDatabase() {
    return this.query('CREATE DATABASE IF NOT EXISTS good_bot_bad_bot_test');
  }

  /**
  * @summary Loads existing database structure into test database
  * @returns Returns promise
  * */
  loadDatabase() {
    return this.query(this.sql);
  }

  /**
  * @summary Caches table names to `this.tables` for later use
  * @returns Returns promise
  * */
  cacheTables() {
    const tableField = 'Tables_in_good_bot_bad_bot_test';
    return this
      .query('SHOW TABLES')
      .then((results) => {
        this.tables = results.map((result) => result[tableField]);
      });
  }

  /**
  * @summary Uses a chain of promises to create, then load the test database.
  *     Also caches table names internally for later use
  * @returns Returns promise
  * */
  setupDatabase() {
    return this.createDatabase().then(() => {
      return this.loadDatabase().then(() => {
        return this.cacheTables();
      });
    });
  }

  /**
  * @summary Uses cached table list to truncate test tables
  * @returns Returns promise
  * */
  refreshTables() {
    const deletePromises = this.tables.map((table) => {
      return this.query('TRUNCATE TABLE ??', [table]);
    });
    return Q.all(deletePromises);
  }
}

/**
* @summary Sets up test database
* */
beforeAll(function(done) {
  const db = new DB();
  this.db = db;

  db.connect();
  db.setupDatabase()
    .then(done)
    .catch((err) => { console.error(err); done(); });
})

/**
* @summary Refreshes tables in test database so that data from one test
*     does not pollute another test
* */
beforeEach(function(done) { 
  this.db.refreshTables()
    .then(done)
    .catch((err) => { console.error(err); done(); });
})

/**
* @summary Returns foreign key constraints and tears down database connection
* */
afterAll(function(done) {
  this.db.query('SET foreign_key_checks = 1')
    .then(() => { this.db.destroy(); done(); })
    .catch((err) => { console.error(err); done(); });
})