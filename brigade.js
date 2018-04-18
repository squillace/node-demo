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

  // We can do insane things, like construct the image name.
  const imageName = hook.repository.repo_name + ":" + hook.push_data.tag;
  const j = new Job("test", imageName)
  j.tasks = [
    "yarn test"
  ];

  j.run().catch( err => {
    const slack = new Job("notify-failed-tests", "technosophos/slack-notify:latest");
    slack.env = {
      SLACK_WEBHOOK: p.secrets.SLACK_WEBHOOK || "unknown",
      SLACK_USERNAME: "Draft",
      SLACK_TITLE: `Tests failed for ${ hook.repository.repo_name }`,
      SLACK_MESSAGE: "Run `brig build logs --jobs " + e.buildID + "` to see why.",
      SLACK_COLOR: "danger"
    }
    slack.run();
  })
})

// This is for the outer dev loop
events.on("push", (e, p) => {
  console.log("Received GitHub push event")

  // Note that we are running the source as-is, not inside of the iamge
  // created. We could do this either way. I just wanted to illustrate the
  // flexibility of this system.
  const tests = new Job("gh-tests", "node:9-alpine")
  tests.tasks = [
    "cd /app",
    "yarn install",
    "yarn test"
  ]

  tests.run().then( ()=> {
    console.log("tests completed successfully")
    ghNotify("success", "Passed", e, p).run()
  }).catch((e) => {
    console.log("tests failed")
    ghNotify("failure", `failed: ${e.toString()}`, e, p).run()
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
