process.env.NODE_ENV = 'test';

import fetch from 'node-fetch'
import {expect} from "chai"
import {exec} from "child_process"
import Server from './httpServer.js'
import JSZip  from "jszip"

const Lively4bootfilelistName = ".lively4bootfilelist"
const Lively4bundleName = ".lively4bundle.zip"
const Lively4transpileDir = ".transpiled"
const Lively4optionsDir = ".options"

import fs from 'fs';

var port = 8081;

function run(cmd) {
  return  new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      // if (error) reject(stderr)
      resolve({stdout, stderr, error});      
    });
  })
}

describe("Lively4 Server", () => {  
  var tmp = "tmp/";
  var testrepo = "lively4-dummy";
  var url = "http://localhost:" + port+"/";

  async function expectResultMatch(cmd, regexString) {
    var result = await run(`cd ${tmp}${testrepo};` + cmd); 
    expect(result.stdout).match(new RegExp(regexString));
  }
  
  before(async function() {
    Server.lively4dir = tmp;
    Server.port = port;
    Server.autoCommit = true
    this.timeout(35000);
    var result = await run(`rm -rv "${tmp}"; mkdir -v "${tmp}"; cd "${tmp}";` +
      `git clone https://github.com/LivelyKernel/${testrepo};` +
      `cd ${testrepo}; git --reset hard`);
    
    
    console.log("stdout: " + result.stdout);
    await Server.start();
    
   

  });

  describe("GET", () => {
    it("read directory", async () => {
      var response = await fetch(url, {
        method: "GET",
      })
      var body = await response.text() 
      expect(body).to.match(/lively4-dummy/);
    });

    it("read file", async () => {
      var response = await fetch(url + "lively4-dummy/README.md", {
        method: "GET",
      })
      var body = await response.text() 
      expect(body).to.match(/A dummy repository/);
      expect(response.headers.get("fileversion"),"fileversion").length.gt(0)
      expect(response.headers.get("modified"),"modified").length.gt(0)
    });
    
    it("read bundle", async () => {
      var response = await fetch(url + "lively4-dummy/" + Lively4bundleName, {
        method: "GET",
      })
      var body = await response.arrayBuffer() 
      console.log("BODY " + body)
      var zip = await JSZip.loadAsync(body)
      var files = Object.keys(zip.files);

      // console.log("Bundled files:" , files)
      
      expect(files).to.include("README.md")
      expect(files).to.include("foo.js")
      expect(files).to.include(".options/foo.js")
    
    })
  })
  
  describe("PUT", () => {
    it("write file", async function() {
      var filename = 'testwrite.txt';
      var authorName = 'Joe';
      var authorEmail = "joe@lively-kernel.org";
      var content = "The test says hello!";
      var response = await fetch(url + testrepo + "/" + filename, {
        method: "PUT",
        body: content,
        headers: {
            gitusername: authorName,
            gitemail: authorEmail
        }
      })
      expect(response.status, "status").to.equal(200);
      await expectResultMatch("cat " + filename, content);
      await expectResultMatch("git status" , /nothing to commit/);
      await expectResultMatch("git log -n 1 --format='%aN' "+ filename , authorName);
      await expectResultMatch("git log -n 1 --format='%aE' " + filename, authorEmail);
    });    
  })

  describe("MKCOL", async () => {
    it("creates a directory", async () => {
      var response = await fetch(url + testrepo + "/newdir", {
        method: "MKCOL"
      })
      expect(response.status).to.equal(200);
      await expectResultMatch("ls -d newdir", "newdir\n")
    })
  })

  describe("OPTIONS", function() {
    this.timeout(2100)
    it("lively4 root directory", async () => {
      var response = await fetch(url, {
        method: "OPTIONS",
      })
      expect(response.status).to.equal(200);
    });
    it("directory", async () => {
      var response = await fetch(url + "lively4-dummy/", {
        method: "OPTIONS",
      })  
      expect(response.status).to.equal(200);
      var stats = await response.json()
      expect(stats.type).to.equal("directory");
    });

    it("directory without slash", async () => {
      var response = await fetch(url + "lively4-dummy", {
        method: "OPTIONS",
      })
      expect(response.status).to.equal(200);
    });
    
    it("should show versions", async() => {
      var response = await fetch(url + "lively4-dummy/README.md", {
        method: "OPTIONS",
        headers: {
          showversions: true
        }
      })
      var content = await response.json()
      expect(content.versions, "versions").length.to.be.gt(0)
    })
    
    it("should show versions on directories", async() => {
      var response = await fetch(url + "lively4-dummy/", {
        method: "OPTIONS",
        headers: {
          showversions: true
        }
      })
      var content = await response.json()
      expect(content.versions, "versions").length.to.be.gt(0)
    })
    
    it("should show filelist", async() => {
      var response = await fetch(url + "lively4-dummy/", {
        method: "OPTIONS",
        headers: {
          filelist: true
        }
      })
      var content = await response.json()
      expect(content.type, "type").to.be.equal("filelist")
      expect(content.contents, "contents").length.to.be.gt(0)
    })
  });
  
  describe("TMP", function() {
    it("should create tmp file", async() => {
      var filename = `${url}_tmp/foo_${Date.now()}.txt`
      var body = "hello world"
      var response = await fetch(filename, {
        method: "PUT",
        body: body
      })
      var loaded = await fetch(filename).then(r => r.text())
      expect(loaded, "tmp content").to.be.equal(body)
    })
   })
});
