import { NextResponse } from "next/server";
import { Webhooks } from "@octokit/webhooks";
import { createReviewComment, getInstallationForRepo } from "@/lib/github";
import { createOpenCodeSession } from "@/lib/daytona";
import {
  handleInstallationEvent,
  handleInstallationRepositoriesEvent,
} from "@/lib/installations";

const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "";

const webhooks = new Webhooks({
  secret: webhookSecret,
});

export async function POST(request: Request) {
  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");
  const signature = request.headers.get("x-hub-signature-256");
  const body = await request.text();

  if (!event || !signature || !body) {
    return NextResponse.json(
      { error: "Missing required headers or body" },
      { status: 400 }
    );
  }

  try {
    await webhooks.verify(body, signature);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    console.error("Failed to parse webhook payload:", error);
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  console.log(`Received GitHub webhook: ${event} (delivery: ${deliveryId})`);

  if (event === "pull_request") {
    const action = payload.action;
    const prNumber = payload.pull_request?.number;
    const title = payload.pull_request?.title;
    const author = payload.pull_request?.user?.login;

    console.log(`Pull request #${prNumber}: ${title} (${action}) by ${author}`);

    switch (action) {
      case "reopened": {
        const user = payload.pull_request?.head?.repo?.owner?.login;
        const repo = payload.pull_request?.head?.repo?.name;

        // Look up installation ID dynamically from DB
        const installationId = await getInstallationForRepo(user, repo);
        if (!installationId) {
          console.error(`No installation found for ${user}/${repo}`);
          return NextResponse.json(
            { error: "No installation found for this repo" },
            { status: 404 }
          );
        }

        await createReviewComment(
          user,
          repo,
          prNumber,
          "Generating preview...",
          installationId
        );

        const { previewUrl } = await createOpenCodeSession({
          repoUrl: `https://github.com/${user}/${repo}.git`,
          branch: payload.pull_request?.head?.ref,
          name: `pr-${prNumber}`,
          public: true,
          autoStopInterval: 30,
        });

        await createReviewComment(
          user,
          repo,
          prNumber,
          "Preview generated successfully!: " + previewUrl,
          installationId
        );

        break;
      }
    }
  }

  if (event === "installation") {
    await handleInstallationEvent(payload);
  }

  if (event === "installation_repositories") {
    await handleInstallationRepositoriesEvent(payload);
  }

  return NextResponse.json({ ok: true, event, deliveryId });
}
