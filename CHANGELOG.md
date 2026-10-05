# Changelog

What changed in each version of this extension, newest first.

## 0.2.0

- Ask AI can drive Colima from any conversation: list your profiles and what they are doing, start, stop and create them, and open the dashboard, a profile's cluster or a shell in its VM.
- Opening a profile's cluster, from its row in the navigator, the dashboard, the right-click menu or the notification once it starts, now takes you to the cluster under *Local Kubeconfigs* in the navigator, connected and open, so its resources are right there to browse. Before, it landed you on the cluster's pods list.
- The Colima, Dashboard and profile rows in the navigator are on Lens's current navigator API, so going to one of them from elsewhere in Lens does what a click on it does.
- The Colima item in the navigator shows its name alone, without the Colima logo.

## 0.1.1

- The dashboard's profile table gives each column the room its values need, and shortens them with "…" only once the window is too narrow for them.
- The Marketplace banner's text is larger, so it reads on the card.
- Larger, clearer screenshots in the README.

## 0.1.0

- A Colima item in the navigator holds a Dashboard and your Colima profiles, with whether each is running and Start and Stop on each row.
- Start, stop, open a shell in, and delete a profile from its right-click menu.
- Start or stop the VM of a Colima cluster from the cluster's own right-click menu.
- The dashboard shows every profile's resources and state, with what Colima is doing while a profile starts.
- Create and start a new profile, with or without Kubernetes, and open its cluster in Lens once it is up.
- The status bar shows how many profiles are running.
- Command palette: "Colima: Manage profiles" and "Colima: Create a Kubernetes cluster".
