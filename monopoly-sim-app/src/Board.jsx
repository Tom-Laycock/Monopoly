import "./board.css";

export function Board({ players, boardConfig, callNumbers, currentCallId }) {
  // Determine if we are in "single player" ticket highlight mode
  const singlePlayer = players.length === 1 ? players[0] : null;

  // Find which call numbers have been called up to currentCallId
  const calledNumbers = typeof currentCallId === "number"
    ? callNumbers.slice(0, currentCallId + 1)
    : [];

  return (
    <div className="board">
      {Array.from({ length: 40 }).map((_, tile) => {
        const pos = getGridPosition(tile);
        const flags = boardConfig ? boardConfig[tile] : 0;

        // Determine tile classes based on flags
        let tileClass = "tile";
        if (flags & 2) tileClass += " corner";
        if (flags & 1) tileClass += " house";
        if (flags & 4) tileClass += " chance";
        if (flags & 8) tileClass += " community-chest";
        if (flags === 0) tileClass += " regular";

        // --- Custom highlight logic for single player mode ---
        let customStyle = {};
        let showCurrentCallIcon = false;
        if (singlePlayer) {
          if (singlePlayer.ticket.includes(tile)) {
            customStyle.background = "#4527a0";
            customStyle.color = "#fff";
          }
          if (calledNumbers.includes(tile) && singlePlayer.ticket.includes(tile)) {
            customStyle.background = "#b39ddb";
            customStyle.color = "#311b92";
          }
          var currentCallNumber = callNumbers[currentCallId];
          if (tile === currentCallNumber) {
            showCurrentCallIcon = true; // Don't override background, just show icon
          }
        } else {
          if (calledNumbers.includes(tile)) {
            customStyle.background = "#b39ddb";
            customStyle.color = "#311b92";
          }
          var currentCallNumber = callNumbers[currentCallId];
          if (tile === currentCallNumber) {
            showCurrentCallIcon = true;
          }
        }

        return (
          <div
            key={tile}
            className={tileClass}
            style={{
              gridColumn: pos.col,
              gridRow: pos.row,
              ...customStyle
            }}
          >
            <div className="tile-number" style={{ position: "relative" }}>
              {tile}
              {showCurrentCallIcon && (

                <span style={{
                  position: "absolute",
                  top: 0,
                  right: 6,
                  fontSize: 25,
                }}>⭐</span>

                // Or use an emoji/icon:
                // <span style={{
                //   position: "absolute",
                //   top: 2,
                //   right: 2,
                //   fontSize: 16,
                // }}>⭐</span>
              )}
            </div>
            <div className="players">
              {players
                .filter(p => p.position === tile)
                .map(p => (
                  <div key={p.id} className="player">
                    {p.name}
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Returns 1-based CSS grid position for a Monopoly board
 */
function getGridPosition(tile) {
  // Bottom row: 0 → 9 (right → left), row = 11
  if (tile >= 0 && tile <= 9) {
    return { row: 11, col: 11 - tile }; // shift so it doesn't overlap left column
  }

  // Left column: 10 → 19 (bottom → top), col = 1
  if (tile >= 10 && tile <= 19) {
    return { row: 21 - tile, col: 1 }; // bottom-left = row 11, top-left = row 2
  }

  // Top row: 20 → 29 (left → right), row = 1
  if (tile >= 20 && tile <= 29) {
    return { row: 1, col: tile - 19 }; // col 1 → 10
  }

  // Right column: 30 → 39 (top → bottom), col = 11
  return { row: tile - 29, col: 11 }; // row 2 → 11
}


