import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { prisma } from "@repo/db";

/**
 * Look up the GitHub App installation ID for a given repo from the database.
 */
export async function getInstallationForRepo(
  owner: string,
  repo: string
): Promise<number | null> {
  const repository = await prisma.repository.findFirst({
    where: { fullName: `${owner}/${repo}` },
    include: { installation: true },
  });

  if (!repository) return null;
  if (repository.installation.suspendedAt) return null;
  return repository.installation.githubInstallationId;
}

/**
 * Create a comment on a PR using the GitHub App's installation credentials.
 * The installationId is now passed explicitly instead of read from env.
 */
export async function createReviewComment(
  c: any,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  installationId?: number
) {
  console.log(owner, repo, pullNumber, body);

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) {
    return c.json(
      {
        error:
          "Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY environment variables",
      },
      500
    );
  }

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: parseInt(appId, 10),
      privateKey: privateKey,
      ...(installationId && { installationId }),
    },
  });

  try {
    const authentication = (await octokit.auth({
      type: installationId ? "installation" : "app",
    })) as {
      type: string;
      appId?: number;
      installationId?: number;
    };

    console.log("Authenticated successfully:", authentication.type);

    const { data: comment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });

    console.log(
      `Created review comment on PR #${pullNumber}: ${comment.id}`
    );

    return c.json({
      ok: true,
      message: "Review comment created successfully",
      commentId: comment.id,
      commentUrl: comment.html_url,
    });
  } catch (error) {
    console.error("Error creating review comment:", error);
    return c.json(
      {
        error: "Failed to create review comment",
      },
      500
    );
  }
}
