import { useRef, useState } from "react";
import { Board } from "./Board";
import gameData from "./game.json";

const STEP_DELAY = 200;
const ROLL_DELAY = 600;
const MAX_PLAYERS = 25;

export default function App() {
  const [players, setPlayers] = useState(
    gameData.players.map(p => ({
      ...p,
      position: p.start ?? 0
    }))
  );

  const [currentCall, setCurrentCall] = useState(null);
  const [previousCall, setPreviousCall] = useState(null);
  const [filterIds, setFilterIds] = useState("");

  const [callIndex, setCallIndex] = useState(0); // 0 = start

  const isPaused = useRef(false);
  const playRef = useRef(false); // to prevent multiple loops
  const stopRef = useRef(false); // to stop loops on pause/replay

  // --- Reset players up to a call index ---
  // --- Reset players to the state at slider index (no async movement) ---
  const resetPlayersToCall = index => {
    const newPlayers = gameData.players.map(p => ({
      ...p,
      position: p.start ?? 0
    }));

    // Apply all moves up to the selected call index
    for (let i = 0; i < index; i++) {
      const call = gameData.calls[i];
      for (const r of call.rolls) {
        const rolls = Array.isArray(r.rolls) ? r.rolls : [r.rolls];
        const playerIndex = newPlayers.findIndex(p => p.id === r.playerId);
        if (playerIndex >= 0) {
          const total = rolls.reduce((sum, roll) => sum + roll, 0);
          newPlayers[playerIndex].position =
            (newPlayers[playerIndex].position + total) % 40;
        }
      }
    }

    setPlayers(newPlayers);

    // Update call display
    if (index === 0) {
      setCurrentCall(null);
      setPreviousCall(null);
    } else {
      const lastCall = gameData.calls[index - 1];
      setPreviousCall(
        index > 1
          ? (() => {
            const prevCall = gameData.calls[index - 2];
            return `Call ${prevCall.call + 1}: ${prevCall.number ?? prevCall.id ?? ""}`;
          })()
          : "Start"
      );
      setCurrentCall(
        `Call ${lastCall.call + 1}: ${lastCall.number ?? lastCall.id ?? ""}`
      );
    }
  };


  // --- Play from a specific call index (auto-play) ---
  const playFromIndex = startIndex => {
    if (playRef.current) return;
    stopRef.current = false;

    const playLoop = async () => {
      playRef.current = true; // set here, not before playLoop()
      // Add a delay before the first call
      if (startIndex < gameData.calls.length) {
        await delay(1000); // 1 second delay before first move
      }

      for (let i = startIndex; i < gameData.calls.length; i++) {
        console.log(gameData);
        console.log(stopRef.current);
        console.log(playRef.current);
        console.log(isPaused.current);
        console.log(callIndex);
        console.log(i);

        if (stopRef.current) break;

        setCallIndex(i + 1);
        const call = gameData.calls[i];

        setPreviousCall(
          i > 0
            ? `Call ${gameData.calls[i - 1].call + 1}: ${gameData.calls[i - 1].number ?? gameData.calls[i - 1].id ?? ""}`
            : "Start"
        );
        setCurrentCall(
          `Call ${call.call + 1}: ${call.number ?? call.id ?? ""}`
        );

        // Calculate dynamic delay
        // Calculate dynamic delay based on the player with the most rolls
        const playerRolls = call.rolls.map(r => Array.isArray(r.rolls) ? r.rolls : [r.rolls]);
        const maxRollsIndex = playerRolls.reduce(
          (maxIdx, rolls, idx, arr) => rolls.length > arr[maxIdx].length ? idx : maxIdx,
          0
        );
        const maxRolls = playerRolls[maxRollsIndex].length;
        const sumMaxPlayerRolls = playerRolls[maxRollsIndex].reduce(
          (sum, roll) => sum + (typeof roll === "number" ? roll : 0),
          0
        );
        const callDelay = (maxRolls * ROLL_DELAY) + (sumMaxPlayerRolls * STEP_DELAY) + 2000;

        console.log(playerRolls);
        console.log(maxRollsIndex);
        console.log(maxRolls);
        console.log(sumMaxPlayerRolls);
        console.log(callDelay);

        await playCall(call);

        await delay(1000);

        /*
                // Wait dynamic call delay (or pause)
                let elapsed = 0;
                while (elapsed < callDelay) {
                  if (stopRef.current) break;
                  if (!isPaused.current) elapsed += 200;
                  await delay(200);
                }
        */
        // Pause handling
        while (isPaused.current) {
          if (stopRef.current) {
            playRef.current = false;
            return;
          }
          await delay(200);
        }
      }
      playRef.current = false;
    };

    playLoop();
  };


  // --- Play a single call ---
  const playCall = async call => {
    const entries = call.rolls.map(r => ({
      playerId: r.playerId,
      rolls: Array.isArray(r.rolls) ? r.rolls : [r.rolls]
    }));

    const maxRolls = Math.max(...entries.map(e => e.rolls.length));

    for (let rollIndex = 0; rollIndex < maxRolls; rollIndex++) {
      const activeMoves = entries
        .map(e => ({
          playerId: e.playerId,
          spaces: e.rolls[rollIndex]
        }))
        .filter(e => typeof e.spaces === "number");

      await movePlayersTogether(activeMoves);

      if (stopRef.current) return;

      // Pause handling
      while (isPaused.current) {
        if (stopRef.current) return;
        await delay(200);
      }

      await delay(ROLL_DELAY);
    }
  };

  const movePlayersTogether = async moves => {
    const maxSteps = Math.max(...moves.map(m => m.spaces));

    for (let step = 0; step < maxSteps; step++) {
      setPlayers(prev =>
        prev.map(p => {
          const move = moves.find(m => m.playerId === p.id);
          if (!move) return p;

          if (step < move.spaces) {
            return {
              ...p,
              position: (p.position + 1) % 40
            };
          }
          return p;
        })
      );

      await delay(STEP_DELAY);

      while (isPaused.current) {
        if (stopRef.current) return;
        await delay(200);
      }
    }
  };

  // --- Slider handler ---
  const handleSliderChange = value => {
    // Only pause if user is interacting (not programmatic change)
    isPaused.current = true;
    stopRef.current = true;
    setCallIndex(value);
    resetPlayersToCall(value);
  };

  // --- Resume ---
  const handleResume = () => {
    if (!isPaused.current) return;
    isPaused.current = false;
    stopRef.current = false;
    playRef.current = false; // ensure it's false before starting

    console.log(isPaused.current);

    playFromIndex(callIndex); // continue from slider
  };

  const handleReplay = () => {
    stopRef.current = true;
    isPaused.current = false;
    playRef.current = false;

    resetPlayersToCall(callIndex); // reset board to slider state
    stopRef.current = false;

    console.log(isPaused.current);

    playFromIndex(callIndex); // play from slider
  };


  const filteredPlayers = filterIds
    ? players.filter(p =>
      filterIds.split(",").map(id => id.trim()).includes(String(p.id))
    )
    : players.slice(0, MAX_PLAYERS);

  /*
  const filteredPlayers = filterIds.trim()
    ? gameData.players
      .filter(p =>
        filterIds
          .split(",")
          .map(id => id.trim())
          .filter(id => id.length > 0)
          .includes(String(p.id))
      )
      .slice(0, MAX_PLAYERS)
    : players;
 

  console.log(players);
  console.log(gameData.players);
 */
  // Select all call numbers into an int array
  const callNumbers = gameData.calls.map(call => call.number);

  // Get the current call id (null if at start)
  const currentCallId = callIndex > 0 && gameData.calls[callIndex - 1]
    ? gameData.calls[callIndex - 1].call
    : null;

  return (
    <div style={{ position: "relative", padding: "20px", flexDirection: "row", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div>
        <Board players={filteredPlayers} boardConfig={gameData.board} callNumbers={callNumbers} currentCallId={currentCallId} />

        <div className="call_info" style={{ textAlign: "center", marginBottom: "10px", display: "flex", justifyContent: "center", gap: "8px" }}>
          <div>
            <div style={{ fontWeight: "bold" }}>Call Index:</div>
            <div>Called Number:</div>
          </div>

          {gameData.calls.map((call, idx) => (
            <div key={idx} style={{ display: "inline-block", padding: "2px 6px", border: "1px solid #ccc", borderRadius: "4px" }}>
              <div style={{ fontWeight: "bold" }}>{idx + 1}</div>
              <div>{call.number ?? call.id ?? ""}</div>
            </div>
          ))}
        </div>

        {/* Call display */}
        <div className="call-display" style={{ marginTop: "20px" }}>
          <div className="current-call">
            {callIndex === 0
              ? "Start"
              : (() => {
                const call = gameData.calls[callIndex - 1];
                if (!call) return "";
                return `Call ${call.call + 1}: ${call.number ?? call.id ?? ""}`;
              })()}
          </div>
          {previousCall && <div className="previous-call">{previousCall}</div>}

          {/* Filter Users */}
          <div style={{ textAlign: "center", margin: "10px 0", pointerEvents: "all" }}>
            <label>
              Show only IDs (comma-separated):{" "}
              <input
                type="text"
                value={filterIds}
                onChange={e => setFilterIds(e.target.value)}
                placeholder="e.g. 10,22,103"
                style={{ width: "200px" }}
              />
            </label>
          </div>
          {filterIds && <div className="filter-display">Filtered UserIds: {filterIds}</div>}

          {/* Winner display below Start */}
          {Array.isArray(gameData.winnerPlayerIds) && (
            <div style={{ marginTop: "10px", fontWeight: "bold", color: "#388e3c" }}>
              Winner(s){gameData.winnerPlayerIds.length > 1 ? "s" : ""}:{" "}
              {gameData.winnerPlayerIds.join(", ")} on call {gameData.calls.length}
            </div>
          )}
        </div>
      </div>


      {/* Player Tickets */}
      <div>
        <div style={{
          position: "relative",
          top: 0,
          right: 0,
          margin: "40px 20px",
          background: "rgba(255,255,255,0.85)",
          borderRadius: "12px",
          padding: "16px 12px",
          boxShadow: "0 2px 8px #0001",
          maxHeight: "70vh",
          overflowY: "scroll",
        }}>
          <div style={{ fontWeight: "bold", marginBottom: 8, textAlign: "center" }}>Player Tickets</div>

          {(() => {
            // Build called numbers up to current callIndex (call order)
            const calledNumbers = gameData.calls.slice(0, callIndex).map(c => c.number);

            // Helper: count how many ticket numbers are called
            const countMatches = (ticket) =>
              ticket.reduce((acc, n) => acc + (calledNumbers.includes(n) ? 1 : 0), 0);

            // Optional tiebreaker: earliest position in call order where next needed appears
            const nextNeededOrderIndex = (ticket) => {
              const remaining = ticket.filter(n => !calledNumbers.includes(n));
              if (remaining.length === 0) return -1; // completed
              // Find earliest index in future calls for any remaining number
              const futureCalls = gameData.calls.slice(callIndex).map(c => c.number);
              const idxs = remaining
                .map(n => futureCalls.indexOf(n))
                .filter(i => i !== -1);
              return idxs.length ? Math.min(...idxs) : Number.MAX_SAFE_INTEGER;
            };

            // Sort players by matches desc, then by earliest next needed asc
            const sortedPlayers = [...gameData.players].sort((a, b) => {
              const aMatches = countMatches(a.ticket || []);
              const bMatches = countMatches(b.ticket || []);
              if (bMatches !== aMatches) return bMatches - aMatches;
              const aNext = nextNeededOrderIndex(a.ticket || []);
              const bNext = nextNeededOrderIndex(b.ticket || []);
              return aNext - bNext;
            });

            return sortedPlayers.map(player => {
              const ticket = player.ticket || [];
              const unclaimed = ticket.filter(n => !calledNumbers.includes(n));
              const claimed = ticket.filter(n => calledNumbers.includes(n));
              const ordered = [...unclaimed, ...claimed];

              return (
                <div key={player.id} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: "bold", marginRight: 8, minWidth: 18, textAlign: "right" }}>{player.id}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {ordered.map((num, idx) => {
                      const called = calledNumbers.includes(num);
                      return (
                        <span
                          key={idx}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: called ? "#b39ddb" : "#4527a0",
                            color: "#fff",
                            fontWeight: "bold",
                            fontSize: 15,
                            border: called ? "2px solid #ede7f6" : "2px solid #311b92",
                            transition: "background 0.2s"
                          }}
                        >
                          {num}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        {/* Slider + controls */}
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <input
            type="range"
            min={0}
            max={gameData.calls.length}
            value={callIndex}
            onChange={e => handleSliderChange(Number(e.target.value))} // Only user triggers this
            style={{ width: "300px" }}
          />
          <div>Call: {callIndex === 0 ? "Start" : callIndex}</div>

          <div style={{ marginTop: "10px" }}>
            {/* <button onClick={handleResume} disabled={!isPaused.current}>
            Resume
          </button> */}
            <button onClick={handleReplay} style={{ marginLeft: "10px" }}>
              Play from slider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
