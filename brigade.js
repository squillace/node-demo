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
});
