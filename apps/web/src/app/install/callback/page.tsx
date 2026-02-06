import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

interface Props {
  searchParams: Promise<{ installation_id?: string; setup_action?: string }>;
}

export default async function InstallCallbackPage({ searchParams }: Props) {
  const params = await searchParams;
  const installationIdParam = params.installation_id;
  const setupAction = params.setup_action;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    // User isn't logged in — redirect to sign-in, then back here
    const callbackUrl = `/install/callback?installation_id=${installationIdParam}&setup_action=${setupAction}`;
    redirect(`/sign-in?callbackURL=${encodeURIComponent(callbackUrl)}`);
  }

  if (!installationIdParam) {
    redirect("/dashboard");
  }

  const githubInstallationId = parseInt(installationIdParam, 10);

  if (isNaN(githubInstallationId)) {
    redirect("/dashboard");
  }

  // Try to link the installation to the current user.
  // The webhook may have already created the record, or it may arrive later.
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    const installation = await prisma.installation.findUnique({
      where: { githubInstallationId },
    });

    if (installation) {
      // Link to the current user if not already linked
      if (!installation.linkedUserId) {
        await prisma.installation.update({
          where: { id: installation.id },
          data: { linkedUserId: session.user.id },
        });
      }
      break;
    }

    // Webhook hasn't arrived yet — wait briefly and retry
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Sync orgs for the user after installation
  await syncUserOrganizations(session.user.id);

  redirect("/dashboard");
}

async function syncUserOrganizations(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "github" },
  });

  if (!account?.accessToken) return;

  try {
    const response = await fetch("https://api.github.com/user/orgs", {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) return;

    const orgs = (await response.json()) as Array<{
      id: number;
      login: string;
      avatar_url: string;
    }>;

    for (const org of orgs) {
      const organization = await prisma.organization.upsert({
        where: { githubOrgId: org.id },
        update: { login: org.login, avatarUrl: org.avatar_url },
        create: {
          githubOrgId: org.id,
          login: org.login,
          avatarUrl: org.avatar_url,
        },
      });

      await prisma.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId: organization.id,
          },
        },
        update: {},
        create: {
          userId,
          organizationId: organization.id,
          role: "member",
        },
      });
    }
  } catch (error) {
    console.error("Failed to sync organizations:", error);
  }
}
