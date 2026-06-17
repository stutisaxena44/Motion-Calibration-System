# 🚀 The Ultimate Guide: Deploying the Telemetry Sandbox

This guide will walk you through taking your local React application, saving it safely to GitHub, deploying it live to the web using Vercel, and testing the hardware sensors on your iPhone.

---

## Phase 1: Pushing Your Code to GitHub

Before deploying, we need to upload your code to GitHub. This acts as the secure vault for your project.

### Step 1: Create a New Repository on GitHub

1. Go to [GitHub](https://github.com/) and log in.
2. Click the **+** icon in the top right corner and select **New repository**.
3. Name your repository (e.g., `telemetry-sandbox`).
4. Leave it as **Public** and do _not_ check the box to add a README (we want an empty vault for now).
5. Click the green **Create repository** button.
6. Copy the web URL of your new repository from your browser's address bar.

### Step 2: Push Your Code via Terminal

Open the terminal on your computer, ensure you are inside your project folder (`telemetry-sandbox`), and copy-paste these commands one by one. Press **Enter** after each line.

```bash
# 1. Initialize Git in your project folder
git init

# 2. Add all your project files to the staging area
git add .

# 3. Save these files with a commit message
git commit -m "Initial release: Telemetry Sandbox"

# 4. Set the main branch name
git branch -M main

# 5. Connect your local folder to your new GitHub vault
# IMPORTANT: Replace the URL below with the one you copied in Step 1!
git remote add origin https://github.com/your-username/telemetry-sandbox.git

# 6. Push your code up to GitHub
git push -u origin main

```

> **Note:** If this is your first time using Git on this computer, it might ask you to log in to GitHub in the terminal or browser. Just follow the prompts to authorize it!

---

## Phase 2: Deploying Live on Vercel

Vercel is a hosting platform built specifically for modern frontend apps like Vite and React. It is free, incredibly fast, and connects directly to your GitHub.

### Step 1: Import Your GitHub Project

1. Go to [Vercel](https://vercel.com/) and log in (choose **Continue with GitHub**).
2. Once on your dashboard, click the black **Add New...** button and select **Project**.
3. Under "Import Git Repository", find your `telemetry-sandbox` repository and click **Import**.

### Step 2: Configure and Deploy

1. **Framework Preset:** Vercel is smart and will automatically detect that you are using **Vite**. Leave this exactly as it is.
2. **Root Directory:** Leave this as `./`.
3. **Environment Variables:** You don't need any for this project.
4. Click the blue **Deploy** button.

Wait about 30 to 60 seconds. You will see a magical build screen, and then congratulations will pop up. Your app is now live on the internet!

Click **Continue to Dashboard** and click the **Visit** button to see your live website URL (it will look something like `telemetry-sandbox.vercel.app`).

---

## Phase 3: Testing on Your iPhone

Here is the best part: Vercel automatically secures your live website with an **HTTPS certificate**. This means Apple's strict security rules are finally satisfied, and you won't have to deal with any local network configuration or scary browser warnings.

1. Open **Safari** on your iPhone.
2. Type in your brand new Vercel URL (e.g., `https://telemetry-sandbox.vercel.app`).
3. Once the page loads, tap the **Request IMU Permissions** button in the Hardware Console.
4. A clean Apple prompt will ask for access to "Motion & Orientation". Tap **Allow**.

**You are done!** Pick up your phone, tilt it forward, backward, and side to side. The 3D virtual chassis on your screen will perfectly mirror your physical movements with zero lag.
