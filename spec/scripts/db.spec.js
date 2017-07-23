describe("A suite is just a function", function() {
  it("and so is a spec", function(done) {
    this.db.query("insert into voter (voterName) values (?)", ['good bot bad bot'])
      .then(() => {
        this.db.query("select * from voter").then((res) => {
          expect(res[0].voterName).toBe('good bot bad bot');
          done();
        });
      });
  });
});