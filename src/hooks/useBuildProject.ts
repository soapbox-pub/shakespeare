import { useMutation } from "@tanstack/react-query";
import { buildProject } from "@/lib/build";
import { useFS } from "./useFS";

export function useBuildProject(projectId: string) {
  const { fs } = useFS();

  return useMutation({
    mutationFn: async () => {
      return await buildProject({
        fs,
        projectPath: `/projects/${projectId}`,
        domParser: new DOMParser(),
      });
    },
  });
}