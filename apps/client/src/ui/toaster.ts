import { createToaster } from "@chakra-ui/react";

export const toaster: ReturnType<typeof createToaster> = createToaster({
  placement: "top",
  pauseOnPageIdle: true,
});
