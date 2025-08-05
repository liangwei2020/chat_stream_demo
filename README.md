### 后端设置
```
# 创建并激活conda环境
conda create -n fastapi_demo python=3.10 -y
conda activate fastapi_demo

# 安装后端依赖
cd server
pip install -r requirements.txt

# 配置API密钥 (创建.env文件)
echo "DEEPSEEK_API_KEY=your_api_key_here" > .env
# 启动项目
python main.py
```


### 前端设置
```
# 安装nvm (Node版本管理器)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# 重新加载终端配置
source ~/.bashrc  # 或 source ~/.zshrc (如果是zsh)

# 安装Node.js 20
nvm install 20
nvm use 20

# 安装pnpm包管理器
npm install -g pnpm

# 安装前端依赖
cd ./web
pnpm install

# 启动项目
pnpm run dev
```


### 访问地址
1. 前端：http://127.0.0.1:8000
2. 后端服务地址：http://127.0.0.1:3000