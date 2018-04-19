const http = require("http");
const express = require("express");
const convict = require("convict");
const hello = require("./hello");


var config = convict({
    // Example of a custom var. See chart/values.yaml for the definition.
    exampleVar: {
        doc: "This is an example. Feel free to delete or replace.",
        default: "EMPTY",
        env: "EXAMPLE"
    },

    // Predefined vars.
    port: {
        doc: "Port number",
        default: 8080,
        format: "port",
        env: "NODE_APP_PORT"
    },
    ip: {
        doc: "The pod IP address assigned by Kubernetes",
        format: "ipaddress",
        default: "127.0.0.1",
        env: "NODE_APP_IP"
    },
    namespace: {
        doc: "The Kubernetes namespace. Usually passed via downward API.",
        default: "default",
        env: "NODE_APP_NAMESPACE"
    },
    appName: {
        doc: "The name of this app, according to Kubernetes",
        default: "unknown",
        env: "NODE_APP_NAME"
    }
});
config.validate({allowed: 'strict'});


// ==== THE MAIN STUFF ====
const app = express();
app.get("/hello", (req, res) => {
    // Example response:
    res.send(hello.world());
});

// ==== BOILERPLATE ====
// Kubernetes health probe. If you remove this, you will need to modify
// the deployment.yaml in the chart.
app.get("/healthz", (req, res)=> {
    res.send("OK");
})
// Start the server.
http.createServer(app).listen(config.get('port'), () => {
    console.log(`Running on ${config.get("ip")}:${config.get("port")}`)
})
