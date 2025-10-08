import { useMutation } from "@tanstack/react-query";
import { buildProject } from "@/lib/build";
import { useFS } from "./useFS";
import { useAppContext } from "./useAppContext";

export function useBuildProject(projectId: string) {
  const { fs } = useFS();
  const { config } = useAppContext();

  return useMutation({
    mutationFn: async () => {
      return await buildProject({
        fs,
        projectPath: `/projects/${projectId}`,
        domParser: new DOMParser(),
        esmUrl: config.esmUrl,
      });
    },
  });
}