# Monopoly Sim App

### How to run

1. cd into the Monopoly/monopoly-sim-app directory
2. nvm use 22.21.1
3. npm install
4. npm run dev

### Information

- Call numbers at the bottom
- Tickets on the right, userId > ticket numbers
- Call in the center of the board
- Winner in green at the center of the board
- Filter for specific users to view only those format is comma seperated numbers, no spaces

- STAR - Current Call Tile

- BEIGE - Corner Tile
- BLUE - Community Chest Tile
- YELLOW - Chance Tile

#### When no filter applied or more than 1 user filtered

- LIGHT PURPLE - Previously Called Tile

#### When only 1 user is filtered

- LIGHT PURPLE - Claimed Tile
- DARK PURPLE - Unclaimed Tile

### How to use

- Press play from slider to start the sequence
- Move the slider to pause the sequence and select a specific call
- If the players appear to be moving too fast refresh the page and move the slider to the desired point

### Warnings

- Clicking the play button multiple times or during a running sequence without moving the slider may break the sequence.
