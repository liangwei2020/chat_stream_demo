from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import os
import json
import re
from dotenv import load_dotenv

load_dotenv()  # 加载.env文件中的环境变量

app = FastAPI()

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions"

class ChatMessage(BaseModel):
    message: str

@app.get("/chat")
@app.post("/chat")
async def chat_stream(request: Request, message: str = None):
    # 尝试从查询参数获取消息
    if not message:
        # 尝试从请求体获取消息
        try:
            body = await request.json()
            message = body.get("message")
        except:
            pass
    
    if not message:
        raise HTTPException(status_code=400, detail="缺少消息内容")
    
    print('接收到消息:', message)
    
    async def event_generator():
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": message}],
            "stream": True
        }
        
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                async with client.stream(
                    "POST", 
                    DEEPSEEK_ENDPOINT,
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        yield {"event": "error", "data": f"API请求失败: {response.status_code}"}
                        return
                    
                    # 新的流式响应处理逻辑
                    buffer = ""  # 用于累积完整响应
                    
                    async for chunk in response.aiter_lines():
                        # 跳过空行
                        if not chunk.strip():
                            continue
                            
                        # 调试日志
                        print(f"原始数据: {chunk}")
                        
                        # 处理数据前缀行
                        if chunk.startswith("data:"):
                            data_line = chunk[5:].strip()
                            
                            # 检测结束标记
                            if data_line == "[DONE]":
                                # 发送累积的完整内容
                                if buffer:
                                    yield {"data": buffer}
                                yield {"event": "end", "data": "completed"}
                                return
                            
                            # 尝试解析为JSON
                            try:
                                # 处理多个JSON对象合并的情况
                                if data_line.startswith('{') and data_line.endswith('}'):
                                    # 尝试解析单个JSON对象
                                    json_data = json.loads(data_line)
                                    if "choices" in json_data and len(json_data["choices"]) > 0:
                                        content = json_data["choices"][0]["delta"].get("content", "")
                                        if content:
                                            buffer += content
                                            yield {"data": buffer}
                                        continue
                                elif re.search(r'}\s*{', data_line):
                                    # 处理多个JSON对象连在一起的情况
                                    json_objects = re.split(r'(?<=})\s*(?={)', data_line)
                                    for json_str in json_objects:
                                        try:
                                            json_data = json.loads(json_str)
                                            if "choices" in json_data and len(json_data["choices"]) > 0:
                                                content = json_data["choices"][0]["delta"].get("content", "")
                                                if content:
                                                    buffer += content
                                                    yield {"data": buffer}
                                        except:
                                            # 如果解析失败，作为普通文本处理
                                            buffer += json_str
                                            yield {"data": buffer}
                                    continue
                            except:
                                # JSON解析失败，作为普通文本处理
                                pass
                            
                            # 处理特殊格式的响应
                            # 如果是单个单词或字符
                            if re.match(r'^[\w\s.,!?;:"\'()\[\]{}\\/+=*&^%$#@~`|<>-]+$', data_line):
                                buffer += data_line + " "
                                yield {"data": buffer}
                            else:
                                # 处理特殊字符
                                buffer += data_line
                                yield {"data": buffer}
                        
                        # 处理结束事件
                        elif chunk.startswith("event: end"):
                            if buffer:
                                yield {"data": buffer}
                            yield {"event": "end", "data": "completed"}
                            return
            except Exception as e:
                yield {"event": "error", "data": f"连接错误: {str(e)}"}

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)