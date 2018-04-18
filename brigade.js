const {events, Job} = require("brigadier");

events.on("exec", (e, project) => {
  console.log("exec hook fired");
});

// This is for the local dev loop.
events.on("image_push", (e, p) => {
  console.log(e.payload);
  const hook = JSON.parse(e.payload);

  // We are only going to process :edge tags.
  if (hook.push_data.tag != "edge") {
    console.log("Ignoring non-edge hook")
    return
  }

  /*
   * Unit tests
   * These are run against the image that Draft built
   */

  // We can do insane things, like construct the image name.
  const imageName = hook.repository.repo_name + ":" + hook.push_data.tag;
  const j = new Job("test", imageName)
  j.tasks = [
    "yarn test"
  ];

  j.run().catch( err => {
    const title = `Tests failed for ${ hook.repository.repo_name }`;
    const msg = "Run `brig build logs --jobs " + e.buildID + "` to see why.";
    slack = slackNotify("danger", title, msg, e, p)
    slack.run();
  })

  /*
   * Functional tests
   * These are run against the service that Draft started.
   */

  const funcTests = new Job("ftest", "alpine:3.7");
  funcTests.tasks = [
    "apk update && apk add curl"
  ];

  const uris = ["healthz", "hello"];
  for (const uri of uris) {
    const cmd = `curl -sf http://$NODE_DEMO_CHART_SERVICE_HOST/${ uri }`
    funcTests.tasks.push("echo Testing " + cmd)
    funcTests.tasks.push(cmd)
  }

  funcTests.run().catch(err => {
    const title = `Functional tests failed for ${ hook.repository.repo_name }`;
    const msg = "Run `brig build logs --jobs " + e.buildID + "` to see why.";
    slack = slackNotify("danger", title, msg, e, p)
    slack.run();
  })
})

// This is for the outer dev loop
events.on("push", (e, p) => {
  console.log("Received GitHub push event")
  console.log(e)

  // Note that we are running the source as-is, not inside of the iamge
  // created. We could do this either way. I just wanted to illustrate the
  // flexibility of this system.
  const tests = new Job("gh-tests", "node:9-alpine")
  tests.tasks = [
    "cd /src",
    "yarn install",
    "yarn test"
  ]

  tests.run().then( ()=> {
    console.log("tests completed successfully")
    ghNotify("success", "Passed", e, p).run()
  }).catch((err) => {
    console.log("tests failed")
    ghNotify("failure", `failed: ${err.toString()}`, e, p).run()
  })
});

function ghNotify(state, msg, e, project) {
  const gh = new Job(`notify-${ state }`, "technosophos/github-notify:latest")
  gh.env = {
    GH_REPO: project.repo.name,
    GH_STATE: state,
    GH_DESCRIPTION: msg,
    GH_CONTEXT: "brigade",
    GH_TOKEN: project.secrets.ghToken,
    GH_COMMIT: e.revision.commit
  }
  return gh
}

var count = 0;

function slackNotify(state, title, msg, e, p) {
  const slack = new Job(`slack-notify-${count}`, "technosophos/slack-notify:latest");
  slack.env = {
    SLACK_WEBHOOK: p.secrets.SLACK_WEBHOOK || "unknown",
    SLACK_USERNAME: "Draft",
    SLACK_TITLE: title,
    SLACK_MESSAGE: msg,
    SLACK_COLOR: state
  }
  count++;
  return slack
}
