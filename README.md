# Elza-coin059

A click-to-earn reward system where users click coins to accumulate points and unlock cash rewards.

## Features

- **User Authentication** - Register and login with Gmail
- **Click System** - Click coins to earn points
- **Auto Clicker** - Purchase auto-click upgrades to earn passively
- **Click Multipliers** - Buy multipliers to increase earning rate
- **Reward Milestones** - Unlock cash rewards at specific click thresholds
- **User Withdrawals** - Withdraw your earnings directly to Binance or Gift Card
- **Redeem Codes** - Enter promo codes to get bonus points
- **Admin Panel** - Manager account with special powers:
  - Purchase bulk x multipliers (1000x for 1500 points, 10000x for 3000 points)
  - Give free 20x multiplier to all users
  - Buy massive point amounts (10,000,000 points)
  - Withdraw earnings to Binance or Gift Card

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

```bash
# Install dependencies
npm install

# Start the server
npm start
# or
node server.js
```

The application will run at `http://localhost:3000`

## Environment Variables

You can customize the admin account using environment variables:

```bash
MANAGER_USERNAME=ElzakaryGustinvil049
MANAGER_EMAIL=elzakaryg@gmail.com
PORT=3000
```

## Admin Login

**Username:** ElzakaryGustinvil049  
**Email:** elzakaryg@gmail.com  
**Password:** Elzakary049

## File Structure

```
Money/
├── app.js              # Frontend JavaScript
├── server.js           # Backend server
├── index.html          # Main HTML
├── styles.css          # Styling
├── package.json        # Dependencies
├── render.yaml         # Deployment config
├── .gitignore          # Git ignore rules
└── data/               # Database storage
    └── db.json         # User and claim data
```

## API Routes

### Authentication
- `POST /api/register` - Create new account
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user
- `GET /api/session` - Get current session

### Game
- `POST /api/click` - Click the coin
- `POST /api/autoclick` - Auto click trigger
- `POST /api/upgrade` - Purchase upgrade
- `POST /api/claims` - Request milestone withdrawal (Binance or Gift Card)
- `POST /api/user/withdraw` - User withdrawal to wallet
- `POST /api/redeem` - Redeem promo code for bonus points

### Admin
- `GET /api/manager` - Get all users and claims
- `POST /api/admin/buy-x` - Purchase x multiplier
- `POST /api/admin/give-free-x` - Give 20x to all users
- `POST /api/admin/buy-points` - Purchase points
- `POST /api/admin/withdraw` - Withdraw to wallet

## Database

User data is stored in `data/db.json`. Each user has:
- username
- email
- passwordHash
- clicks (total points)
- lastClickAt (rate limiting)
- autoClickLevel (auto clicker strength)
- clickMultiplier (multiplier value)
- owned upgrades (flags like autoclick1, multiplier2, etc.)

## Deployment

### Render.com
1. Push code to GitHub
2. Connect repository to Render
3. Set environment variables in Render dashboard
4. Deploy

### Heroku
```bash
heroku create your-app-name
git push heroku main
```

## License

Proprietary - Elzakary Gustinvil
