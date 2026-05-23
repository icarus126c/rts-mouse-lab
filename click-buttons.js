function clickButtonMode(input) {
  return input?.value ?? "left";
}

function acceptsTrainingButton(event, mode) {
  return mode === "both"
    ? event.button === 0 || event.button === 2
    : event.button === (mode === "right" ? 2 : 0);
}

function suppressArenaContextMenu(arena) {
  arena.addEventListener("contextmenu", (event) => event.preventDefault());
}

window.trainingClickButtons = {
  accepts: acceptsTrainingButton,
  mode: clickButtonMode,
  suppressContextMenu: suppressArenaContextMenu,
};
