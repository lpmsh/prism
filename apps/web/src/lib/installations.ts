import { prisma } from "@repo/db";

interface InstallationPayload {
  action: "created" | "deleted" | "suspend" | "unsuspend";
  installation: {
    id: number;
    account: {
      id: number;
      login: string;
      type: "User" | "Organization";
      avatar_url?: string;
    };
    repository_selection: "all" | "selected";
  };
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
  sender: {
    id: number;
    login: string;
  };
}

interface InstallationRepositoriesPayload {
  action: "added" | "removed";
  installation: {
    id: number;
  };
  repositories_added: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
  repositories_removed: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
}

export async function handleInstallationEvent(payload: InstallationPayload) {
  const { action, installation, repositories, sender } = payload;

  console.log(
    `Installation ${action}: ${installation.account.login} (${installation.account.type}) by ${sender.login}`
  );

  switch (action) {
    case "created": {
      // Try to link to an existing user by matching the sender's GitHub ID
      const account = await prisma.account.findFirst({
        where: {
          providerId: "github",
          accountId: String(sender.id),
        },
      });

      const inst = await prisma.installation.upsert({
        where: { githubInstallationId: installation.id },
        update: {
          githubAccountLogin: installation.account.login,
          githubAccountType: installation.account.type,
          githubAccountAvatarUrl: installation.account.avatar_url ?? null,
          repositorySelection: installation.repository_selection,
          linkedUserId: account?.userId ?? undefined,
          suspendedAt: null,
        },
        create: {
          githubInstallationId: installation.id,
          githubAccountId: installation.account.id,
          githubAccountLogin: installation.account.login,
          githubAccountType: installation.account.type,
          githubAccountAvatarUrl: installation.account.avatar_url ?? null,
          repositorySelection: installation.repository_selection,
          linkedUserId: account?.userId ?? null,
        },
      });

      // Create repository records
      if (repositories && repositories.length > 0) {
        for (const repo of repositories) {
          await prisma.repository.upsert({
            where: { githubRepoId: repo.id },
            update: {
              name: repo.name,
              fullName: repo.full_name,
              private: repo.private,
              installationId: inst.id,
            },
            create: {
              githubRepoId: repo.id,
              name: repo.name,
              fullName: repo.full_name,
              private: repo.private,
              installationId: inst.id,
            },
          });
        }
      }

      console.log(
        `Created installation ${inst.id} with ${repositories?.length ?? 0} repos`
      );
      break;
    }

    case "deleted": {
      await prisma.installation.deleteMany({
        where: { githubInstallationId: installation.id },
      });
      console.log(
        `Deleted installation for ${installation.account.login}`
      );
      break;
    }

    case "suspend": {
      await prisma.installation.updateMany({
        where: { githubInstallationId: installation.id },
        data: { suspendedAt: new Date() },
      });
      console.log(
        `Suspended installation for ${installation.account.login}`
      );
      break;
    }

    case "unsuspend": {
      await prisma.installation.updateMany({
        where: { githubInstallationId: installation.id },
        data: { suspendedAt: null },
      });
      console.log(
        `Unsuspended installation for ${installation.account.login}`
      );
      break;
    }
  }
}

export async function handleInstallationRepositoriesEvent(
  payload: InstallationRepositoriesPayload
) {
  const { action, installation, repositories_added, repositories_removed } =
    payload;

  const inst = await prisma.installation.findUnique({
    where: { githubInstallationId: installation.id },
  });

  if (!inst) {
    console.error(
      `Installation not found for GitHub installation ID ${installation.id}`
    );
    return;
  }

  if (action === "added" && repositories_added.length > 0) {
    for (const repo of repositories_added) {
      await prisma.repository.upsert({
        where: { githubRepoId: repo.id },
        update: {
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          installationId: inst.id,
        },
        create: {
          githubRepoId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          installationId: inst.id,
        },
      });
    }
    console.log(
      `Added ${repositories_added.length} repos to installation ${inst.id}`
    );
  }

  if (action === "removed" && repositories_removed.length > 0) {
    const removedIds = repositories_removed.map((r) => r.id);
    await prisma.repository.deleteMany({
      where: {
        githubRepoId: { in: removedIds },
        installationId: inst.id,
      },
    });
    console.log(
      `Removed ${repositories_removed.length} repos from installation ${inst.id}`
    );
  }
}
