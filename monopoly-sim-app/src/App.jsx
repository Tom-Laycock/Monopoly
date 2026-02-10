import { useRef, useState } from "react";
import { Board } from "./Board";
import { games, gameOptions } from "./games";

const STEP_DELAY = 200;
const ROLL_DELAY = 600;
const MAX_PLAYERS = 25;

export default function App() {
  const [selectedGameKey, setSelectedGameKey] = useState(gameOptions[0]?.key ?? "game");
  const gameData = games[selectedGameKey] ?? games[gameOptions[0]?.key] ?? { players: [], calls: [], board: [] };

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

  const initPlayersFromGame = data =>
    (data.players || []).map(p => ({
      ...p,
      position: p.start ?? 0
    }));

  const stopPlayback = () => {
    stopRef.current = true;
    isPaused.current = false;
    playRef.current = false;
  };

  const handleSelectGame = e => {
    const nextKey = e.target.value;

    stopPlayback();

    setSelectedGameKey(nextKey);
    setCallIndex(0);
    setCurrentCall(null);
    setPreviousCall(null);

    const nextGame = games[nextKey];
    setPlayers(initPlayersFromGame(nextGame));
  };

  // --- Reset players to the state at slider index (no async movement) ---
  const resetPlayersToCall = index => {
    const newPlayers = initPlayersFromGame(gameData);

    // Apply all moves up to the selected call index
    for (let i = 0; i < index; i++) {
      const call = gameData.calls[i];
      if (!call?.rolls) continue;

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

    playFromIndex(callIndex); // continue from slider
  };

  const handleReplay = () => {
    stopRef.current = true;
    isPaused.current = false;
    playRef.current = false;

    resetPlayersToCall(callIndex); // reset board to slider state
    stopRef.current = false;

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

  const batchOutcomeGroups = [
    { title: null, keys: ["numberOfGames"] },
    { title: "Winning call number", keys: ["minWinningCallNumber", "averageWinningCallNumber", "maxWinningCallNumber"] },
    { title: "Winner count", keys: ["minWinnerCount", "averageWinnerCount", "maxWinnerCount"] },
    { title: "Dice rolls for a player", keys: ["minDiceRollsForAPlayer", "averageDiceRollsForAPlayer", "maxDiceRollsForAPlayer"] },
    { title: "Call length", keys: ["minCallLength", "averageCallLength", "maxCallLength"] },
    { title: "Game length", keys: ["minGameLength", "averageGameLength", "maxGameLength"] },
    {
      title: "Stakes & RTP",
      keys: [
        "totalStakePerGame",
        "totalStake",
        "totalPrizeFromCommunityPrize",
        "individualPrizeFromCommmunityPrize",
        "rtp"
      ]
    },
    { title: null, keys: ["ammountWonCommunityPrize"] }
  ];

  const formatMoneyFromMinorUnits = (value, currency = "GBP") => {
    if (typeof value !== "number" || Number.isNaN(value)) return String(value ?? "");
    // Your data is in minor units (pence). 200 -> £2.00
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 100);
  };

  const formatPercent = value => {
    if (typeof value !== "number" || Number.isNaN(value)) return String(value ?? "");
    return `${value.toFixed(2)}%`;
  };

  const moneyKeys = new Set([
    "totalStakePerGame",
    "totalStake",
    "totalPrizeFromCommunityPrize",
    "individualPrizeFromCommmunityPrize"
  ]);

  const renderBatchOutcomeValue = (key, value) => {
    if (moneyKeys.has(key)) return formatMoneyFromMinorUnits(value);
    if (key === "rtp") return formatPercent(value);

    if (typeof value === "number") {
      return Number.isInteger(value) ? value : value.toFixed(3);
    }
    return String(value);
  };

  const renderKeyValueList = obj => {
    if (!obj || typeof obj !== "object") return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {Object.entries(obj).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: "#444" }}>{k}</span>
            <span style={{ fontWeight: 600 }}>
              {typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(3)) : String(v)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ position: "relative", padding: "20px", flexDirection: "column", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>

      <div style={{ display: "flex", flexDirection: "row" }}>
        {/* Game Info */}
        <div>
          <div style={{
            position: "relative",
            top: 0,
            right: 0,
            width: "300px",
            marginRight: "20px",
            background: "rgba(255,255,255,0.85)",
            borderRadius: "12px",
            padding: "16px 12px",
            boxShadow: "0 2px 8px #0001",
            maxHeight: "800px",
            boxSizing: "border-box",
            overflowY: "scroll",
            overflowX: "hidden",
          }}>

            <div>
              <div id="game-info" style={{ fontWeight: "bold", marginBottom: 8, textAlign: "center" }}>Game Info</div>
              {gameData.gameInfo
                ? renderKeyValueList(gameData.gameInfo)
                : <div style={{ color: "#666", fontSize: 13, textAlign: "center" }}>No gameInfo in this file</div>}
            </div>

            <div style={{ marginTop: 16 }}>
              <div id="batch-outcome" style={{ fontWeight: "bold", marginBottom: 8, textAlign: "center" }}>Batch Outcome</div>

              {gameData.batchOutcome ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {batchOutcomeGroups.map((group, idx) => {
                    const lines = group.keys
                      .filter(k => gameData.batchOutcome[k] !== undefined && gameData.batchOutcome[k] !== null)
                      .map(k => ({ key: k, value: gameData.batchOutcome[k] }));

                    if (lines.length === 0) return null;

                    return (
                      <div key={idx} style={{ borderTop: idx === 0 ? "none" : "1px solid #0001", paddingTop: idx === 0 ? 0 : 10 }}>
                        {group.title && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6 }}>
                            {group.title}
                          </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {lines.map(({ key, value }) => (
                            <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <span style={{ color: "#444", maxWidth: 150, wordWrap: "break-word" }}>{key}</span>
                              <span style={{ fontWeight: 600 }}>
                                {renderBatchOutcomeValue(key, value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: "#666", fontSize: 13, textAlign: "center" }}>No batchOutcome for this game</div>
              )}
            </div>

          </div>
        </div>


        <div>
          {/* Game selector */}
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
            <label style={{ fontWeight: 600 }}>
              Game:
              <select value={selectedGameKey} onChange={handleSelectGame} style={{ marginLeft: 8 }}>
                {gameOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Board players={filteredPlayers} boardConfig={gameData.board} callNumbers={callNumbers} currentCallId={currentCallId} />

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
              <div style={{ marginTop: "10px", fontWeight: "bold", color: "#388e3c", maxWidth: 400 }}>
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

        </div>

      </div>

      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%" }}>

        <div className="call_info" style={{
          textAlign: "center",
          marginBottom: "10px",
          display: "flex",
          justifyContent: "center",
          gap: "8px"
        }}>
          <div>
            <div style={{ fontWeight: "bold" }}>Call Index:</div>
            <div>Called Number:</div>
          </div>

          {gameData.calls.map((call, idx) => (
            <div key={idx} style={{
              display: "inline-block",
              padding: "2px 6px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              height: "min-content"
            }}>
              <div style={{ fontWeight: "bold" }}>{idx + 1}</div>
              <div>{call.number ?? call.id ?? ""}</div>
            </div>
          ))}
        </div>

        {/* Slider + controls */}
        <div style={{ marginTop: "0px", textAlign: "center" }}>
          <input
            type="range"
            min={0}
            max={gameData.calls.length}
            value={callIndex}
            onChange={e => handleSliderChange(Number(e.target.value))} // Only user triggers this
            style={{ width: "300px" }}
          />
          <div>Call: {callIndex === 0 ? "Start" : callIndex}</div>
        </div>

        <button onClick={handleReplay} style={{ marginLeft: "10px" }}>
          Play from slider
        </button>

      </div>
    </div>
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
