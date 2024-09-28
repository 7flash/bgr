# Bun-Git-Run (BGR) 🎉

## Description 📄
Bun-Git-Run (BGR) is a sophisticated development tool designed for multi-machine setups. It leverages a git-based push-pull model to facilitate code execution on remote machines, logging the outputs, and integrating seamlessly with AI-driven workflows. The tool ensures zero-dependency beyond Bun and TypeScript, making it lightweight and easy to set up.

## Key Features 🚀
- **Multi-Machine Development Setup:** BGR is designed to operate efficiently across multiple machines, allowing seamless development and execution of code on remote environments.
- **Zero-Dependency:** Apart from requiring Bun and TypeScript, BGR does not rely on any external libraries, ensuring a minimalistic and efficient setup.
- **Git-Based Push-Pull Model:** Utilizes temporary branches in a private repository to push code changes, execute them remotely, and commit the logs back. This model ensures the remote machine always has the latest code and can log outputs effectively.
- **AI-Oriented Integration:** The tool allows for the logs to be directly passed into AI prompts, enabling AI to make commits back to the machine. This cyclical process of execution, logging, and AI-driven updates ensures continuous integration and delivery.

## Installation 🛠️
To set up BGR, follow these steps:

1. **Clone the Repository:**
    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```

2. **Install Bun:**
    Follow the instructions on the [Bun website](https://bun.sh) to install Bun.

3. **Setup Environment Variables:**
    Ensure the following environment variables are set:
    - `HOME`: Path to the home directory.
    - `REFRESH_CMD`: Command to execute for logging (default is `echo 777`).

## Usage 💻
To start using BGR, simply run the main script:
```sh
bun run <path-to-script>
```
The tool will automatically:
- Fetch updates from the git repository.
- Check for remote updates and pull them if necessary.
- Execute the specified command and log the outputs.
- Commit and push the logs to a temporary branch in the repository.

### Example Workflow:
1. **Initial Run:**
    ```sh
    bun run src/bgr.ts
    ```
    This will fetch the current state of the repository, execute the default log command, and push the logs.

2. **AI Integration:**
    - Pass the log file `latest-logs.txt` into your AI prompt.
    - Have the AI process the logs and make updates.
    - The script will pick up these changes on the next run, re-execute, and log the new outputs.

## License 📜
This project is licensed under the MIT License.

