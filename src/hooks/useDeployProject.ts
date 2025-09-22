import { useMutation } from "@tanstack/react-query";
import { deployProject } from "@/lib/deploy";
import { useFS } from "./useFS";
import { useAppContext } from "./useAppContext";
import { useCurrentUser } from "./useCurrentUser";

export function useDeployProject(projectId: string) {
  const { fs } = useFS();
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  return useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("You must be logged into Nostr to deploy a project");
      }
      return await deployProject({
        fs,
        projectId: projectId,
        deployServer: config.deployServer,
        projectPath: `/projects/${projectId}`,
        signer: user.signer,
      });
    },
  });
}