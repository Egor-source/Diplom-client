<template>
  <div class="wrapper">
    <div v-show="streamer" class="video-wrapper">
      <video class="video" autoplay :srcObject.prop="mediaStream"></video>
      <div class="video-buttons">
        <button
          :class="[
            'buttonPurple user-sound',
            {
              active: speaks,
            },
          ]"
          :title="speaks ? 'Выключить микрофон' : 'Включить микрофон'"
          @click="voice"
        ></button>
        <button class="buttonPurple" @click="streamControls.streamAction">
          {{ streamControls.streamButtonText }}
        </button>
      </div>
    </div>
    <div v-show="!streamer" class="video-wrapper viewer-wrapper">
      <video class="video viewerVideo" autoplay :src="stream"></video>
      <div class="video-buttons">
        <button
          v-if="curSession && curSession.userRole == 'admin'"
          class="buttonPurple"
          @click="adminButton"
        >
          Показать экран
        </button>
        <button
          :class="[
            'buttonPurple user-sound',
            {
              active: speaks,
            },
          ]"
          @click="voice"
        ></button>
        <button
          style="width: 180px"
          class="buttonPurple"
          @click="openFullScreen"
        >
          {{ fullScreen ? "Свернуть" : "На весь экран" }}
        </button>
      </div>
    </div>
    <div class="card menu">
      <button
        :class="[
          'users-button',
          {
            active: usersVisible,
          },
        ]"
        @click="showUsers"
      >
        Пользователи
      </button>
      <div
        :class="[
          'users',
          {
            active: usersVisible,
          },
        ]"
      >
        <p class="center" v-if="users.length == 0">
          Нет подключенных пользователей
        </p>
        <div class="user" v-for="user in users" :key="user.login + Date.now()">
          <!-- <audio
            :id="user.login"
            class="audio"
            :src="user.voiceStream"
          ></audio> -->
          <div class="user-data">
            <img :src="user.img" alt="user-icon" class="user__icon" />
            <span>{{ user.login }}</span>
          </div>
          <div class="icon-wrapper">
            <img
              v-if="curSession.userRole == 'admin'"
              class="monitor"
              :src="
                user.streamer
                  ? require(`../assets/img/monitor_off.png`)
                  : require(`../assets/img/monitor.png`)
              "
              alt="monitor"
              @click="user.streamerControls.action(user)"
              :title="
                user.streamer
                  ? 'Запретить показ экрана'
                  : 'Разрешить показ экрана'
              "
            />
            <img
              :src="
                user.muted
                  ? require(`../assets/img/microphon_Off.svg`)
                  : require(`../assets/img/microphon_On.svg`)
              "
              alt="microphone"
              class="mikrophone"
              @click="muteUser(user)"
              :title="user.muted ? 'Включить звук' : 'Выключить звук'"
            />
          </div>
        </div>
      </div>
      <div class="chat-wrapper">
        <div class="chat">
          <div class="messages">
            <div class="message" v-for="message in messages" :key="message.id">
              <p class="message__login">{{ message.login }}:</p>
              <p class="message__text">{{ message.text }}</p>
            </div>
          </div>
          <form class="message-form" @submit.prevent="sendMessage">
            <textarea
              placeholder="Напишите сообщение..."
              v-model.trim="message"
              @keyup="textareaPressKey"
            ></textarea>
            <button
              class="send-button buttonPurple center"
              type="submit"
            ></button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as signalR from "@microsoft/signalr";
import { baseServerUrl, webrtcServer } from "../main";
import io from "socket.io-client";
import { v4 } from "uuid";
export default {
  data() {
    return {
      curSession: null,
      mainKey: null,
      keys: null,
      connection: null,
      users: [],
      usersVisible: false,
      messages: [],
      message: "",
      videoServerConnection: null,
      displayMediaOptions: {
        video: true,
      },
      mediaStream: null,
      stream: null,
      streamer: false,
      mediaSource: null,
      sourceBuffer: null,
      streamControls: {
        streamAction: this.startStream,
        streamButtonText: "Показать экран",
      },
      showVideoControls: false,
      fullScreen: false,
      speaks: false,
      voiceMediaStream: null,
      voiceMediaRecorder: null,
    };
  },
  async created() {
    try {
      await this.autorize();
    } catch (e) {
      this.goToLogin(e.message);
      return;
    }

    this.connect();
  },
  async mounted() {
    window.addEventListener("resize", () => {
      this.chatResize();
    });

    this.chatResize();

    window.onfocus = () => {
      let video = document.querySelector(".viewerVideo");
      if (video) {
        video.currentTime = 200000000;
      }
    };

    window.onbeforeunload = () => {
      if (this.streamer) {
        this.stopStream();
        if (this.curSession.userRole != "admin") {
          this.returnStreamingRight();
        }
      }
    };
  },

  methods: {
    //Проверка авторизационных данных пользователя
    async autorize() {
      let curUrl = new URL(window.location.href);
      if (!curUrl.searchParams.has("confirenceId")) {
        this.$router.push({ name: "Create" });
        return;
      }

      let confirenceId = curUrl.searchParams.get("confirenceId");

      let sessionsData = JSON.parse(localStorage.getItem("sessionsData"));

      if (!sessionsData) {
        throw new Error(confirenceId);
      }

      let curSession = sessionsData.find(
        (session) => session.confirenceId == confirenceId
      );

      if (!curSession) {
        throw new Error(confirenceId);
      }

      let response = await fetch(`${baseServerUrl}/api/session/Login`, {
        method: "POST",
        body: JSON.stringify({
          confirenceId: curSession.confirenceId,
          login: curSession.login,
          password: curSession.password,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(curSession.confirenceId);
      }

      this.curSession = curSession;
    },
    //Перекидываетна страницу логина
    goToLogin(confirenceId) {
      this.$router.push({
        name: "Login",
        query: {
          confirenceId: confirenceId,
        },
      });
    },
    //Подключение к серверу
    async connect() {
      try {
        this.connection = new signalR.HubConnectionBuilder()
          .withUrl(`${baseServerUrl}/confirencesHub`)
          .build();

        await this.connection.start();

        this.addEventListeners();

        await this.connection.invoke(
          "UserConnection",
          JSON.stringify({
            confirenceId: this.curSession.confirenceId,
            login: this.curSession.login,
            userRole: this.curSession.userRole,
          })
        );
      } catch (e) {
        alert(e);
      }
    },
    //Устанавливает ключ шифрования
    async setKey() {
      //Администратор конференции генерирует ключ
      if (this.curSession.userRole == "admin") {
        this.mainKey = await window.crypto.subtle.generateKey(
          {
            name: "AES-CTR",
            length: 256,
          },
          true,
          ["encrypt", "decrypt"]
        );
        this.streamer = true;
        this.connectToVideoServer();
        return;
      }

      //Обычные пользователи получают ключ у администратора конференции
      this.keys = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
          hash: { name: "SHA-256" },
        },
        false,
        ["encrypt", "decrypt"]
      );

      let publicKey = await window.crypto.subtle.exportKey(
        "spki",
        this.keys.publicKey
      );

      let byteArray = new Uint8Array(publicKey);

      this.connection.invoke(
        "BetrayPublicKey",
        this.curSession.confirenceId,
        JSON.stringify(byteArray)
      );
    },
    //Обработчики событий вызываемых сервером
    addEventListeners() {
      //Добавляет нового пользователя в список пользователей
      this.connection.on("newUserConnected", async (newUser) => {
        this.users.push(this.user(newUser));

        setTimeout(this.chatResize, 0);

        if (this.mediaRecorder) {
          await this.mediaRecorder.stop();
          this.mediaRecorder = null;
          this.recordMedia();
        }

        if (this.voiceMediaRecorder) {
          this.voiceMediaRecorder.stop();
          this.voiceMediaRecorder = null;
          setTimeout(this.recordVoice(), 1000);
        }
      });

      //Новый пользователь получает список пользователей  конференции
      this.connection.on("getUsersList", (usersListJson, newlogin) => {
        this.users = JSON.parse(usersListJson).map((user) => {
          return this.user(user.login);
        });

        //Если логин пользователя совпадает с одним из уже имеющихся, добавляет ему порядковый номер
        if (this.curSession.login != newlogin) {
          this.curSession.userRole = "user";
          this.curSession.login = newlogin;
        }
        this.setKey();
      });

      //Отправление новому пользователю ключа для шифрования
      this.connection.on("getMainKey", async (jsonKey, callerId) => {
        if (this.curSession.userRole != "admin") {
          return;
        }

        let byteArray = new Uint8Array(Object.values(JSON.parse(jsonKey)));

        let publicKey = await window.crypto.subtle.importKey(
          "spki",
          byteArray.buffer,
          {
            name: "RSA-OAEP",
            hash: { name: "SHA-256" },
          },
          false,
          ["encrypt"]
        );

        let bufferArray = await window.crypto.subtle.exportKey(
          "raw",
          this.mainKey
        );

        let encryptedKey = await window.crypto.subtle.encrypt(
          {
            name: "RSA-OAEP",
          },
          publicKey,
          bufferArray
        );

        this.connection.invoke(
          "BetrayMainKey",
          callerId,
          JSON.stringify(new Uint8Array(encryptedKey))
        );
      });

      //Получение ключа шифрования
      this.connection.on("setMainKey", async (jsonMainKey) => {
        let byteArray = new Uint8Array(Object.values(JSON.parse(jsonMainKey)));

        let decriptKey = await window.crypto.subtle.decrypt(
          {
            name: "RSA-OAEP",
          },
          this.keys.privateKey,
          byteArray.buffer
        );

        this.mainKey = await window.crypto.subtle.importKey(
          "raw",
          decriptKey,
          {
            name: "AES-CTR",
          },
          true,
          ["encrypt", "decrypt"]
        );

        this.connectToVideoServer();
      });
      //Получение сообщения
      this.connection.on("getMessage", async (message) => {
        this.messages.push(
          JSON.parse(
            this.uintToString(
              new Uint8Array(
                await this.decrypt(
                  new Uint8Array(Object.values(JSON.parse(message))).buffer
                )
              )
            )
          )
        );
      });

      this.connection.on("endSession", () => {
        this.$router.push({ name: "ConferanceEnd" });
      });

      this.connection.on("userDisconnected", (login) => {
        this.users = this.users.filter((user) => user.login != login);
      });
    },
    //Шифрование сообщения
    async encrypt(data) {
      let encriptData = await window.crypto.subtle.encrypt(
        {
          name: "AES-CTR",
          counter: new Uint8Array(16),
          length: 128,
        },
        this.mainKey,
        data
      );

      return encriptData;
    },
    //Расшифровка сообщения
    async decrypt(encriptData) {
      let data = await window.crypto.subtle.decrypt(
        {
          name: "AES-CTR",
          counter: new ArrayBuffer(16),
          length: 128,
        },
        this.mainKey,
        encriptData
      );

      return data;
    },
    user(login) {
      let user = {
        login: login,
        muted: false,
        streamer: false,
        img: require(`../assets/img/users_icons/${Math.floor(
          Math.random() * Math.floor(16)
        )}.png`),
        voiceStream: null,
        mediaSource: new MediaSource(),
        sourceBuffer: null,
        queue: [],
        streamerControls: {
          action: this.setStreamer,
        },
      };

      return user;
    },
    //Конвертация строки в Uint8Array
    stringToUint(string) {
      var string = btoa(unescape(encodeURIComponent(string))),
        charList = string.split(""),
        uintArray = [];
      for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
      }
      return new Uint8Array(uintArray);
    },
    //Конвертация Uint8Array в строку
    uintToString(uintArray) {
      var encodedString = String.fromCharCode.apply(null, uintArray),
        decodedString = decodeURIComponent(escape(atob(encodedString)));
      return decodedString;
    },
    showUsers() {
      this.usersVisible = !this.usersVisible;
      setTimeout(this.chatResize, 0);
    },
    muteUser(user) {
      user.muted = !user.muted;
      user.voiceStream.muted = user.muted;
      user.voiceStream.currentTime = 2000000000;
    },
    chatResize() {
      let menu = document.querySelector(".menu");
      let children = menu.childNodes;
      children[2].style.height =
        menu.offsetHeight -
        children[0].offsetHeight -
        children[1].offsetHeight +
        "px";
    },
    textareaPressKey(event) {
      if (event.key == "Enter") {
        this.sendMessage();
        return;
      }
      setTimeout(function () {
        event.target.style.cssText = "height:auto; padding:0";
        event.target.style.cssText =
          "height:" + event.target.scrollHeight + "px";
      }, 0);
    },
    async sendMessage() {
      if (!this.message || this.message.length == 0) {
        return;
      }
      let message = {
        id: v4(),
        login: this.curSession.login,
        text: this.message,
      };
      this.message = "";
      this.messages.push(message);
      let arrayBuffer = await this.stringToUint(JSON.stringify(message)).buffer;
      let encryptedMessage = JSON.stringify(
        new Uint8Array(await this.encrypt(arrayBuffer))
      );
      this.connection.invoke(
        "SendMessage",
        this.curSession.confirenceId,
        encryptedMessage
      );
    },
    async connectToVideoServer() {
      this.videoServerConnection = io(webrtcServer, {
        transport: ["websocket"],
      });
      this.videoServerConnection.emit("join", this.curSession.confirenceId);

      this.newSource();

      let queue = [];
      this.videoServerConnection.on("stream", async (data) => {
        let decriptData = await this.decrypt(data);
        queue.push(decriptData);

        let video = document.querySelector(".viewerVideo");
        video.addEventListener("error", (event) => {
          console.error(event.target.error);
        });

        if (!this.sourceBuffer.updating && queue.length > 0) {
          this.sourceBuffer.appendBuffer(queue.pop());
        }
      });

      this.videoServerConnection.on("endStream", () => {
        this.sourceBuffer.addEventListener("updateend", () => {
          this.mediaSource.endOfStream();
          this.newSource();
        });
      });

      this.videoServerConnection.on("setStreamer", (login) => {
        if (this.curSession.login == login) {
          this.streamer = true;

          this.videoServerConnection.emit(
            "takeAwayStreamingRight",
            this.curSession.confirenceId
          );
        }
      });

      this.videoServerConnection.on("takeAwayStreamingRight", async () => {
        if (this.streamer) {
          if (this.mediaRecorder) {
            this.stopStream();
          }
          this.streamer = false;
        }
      });

      this.videoServerConnection.on("returnStreamingRight", () => {
        this.streamer = this.curSession.userRole == "admin";
        if (this.streamer) {
          this.users.forEach((user) => {
            user.streamerControls.action = this.setStreamer;
            user.streamerControls.text = "Разрешить";
          });
        }
        if (this.mediaRecorder) {
          this.stopStream();
        }
      });

      this.videoServerConnection.on("voiceStream", async (data, login) => {
        let user = await this.users.find((user) => {
          return user.login == login;
        });

        if (!user.voiceStream) {
          user.mediaSource.addEventListener("sourceopen", () => {
            user.sourceBuffer = user.mediaSource.addSourceBuffer(
              "audio/webm;codecs=opus"
            );
          });

          user.voiceStream = new Audio();
          user.voiceStream.src = URL.createObjectURL(user.mediaSource);
          user.voiceStream.play();

        }

        let decriptData = await this.decrypt(data);
        user.queue.push(decriptData);
        setTimeout(() => {
          if (!user.sourceBuffer.updating && user.queue.length > 0) {
            user.sourceBuffer.appendBuffer(user.queue.pop());
          }
        }, 0);
      });

     this.videoServerConnection.on("stopVoiceStream", async (login) => {
        let user = await this.users.find((user) => {
          return user.login == login;
        });
        user.sourceBuffer.addEventListener("updateend", () => {
             user.mediaSource.endOfStream();
          user.voiceStream = null;
          user.mediaSource=new MediaSource();
        });
      });
    },
    newSource() {
      this.mediaSource = new MediaSource();
      this.stream = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener("sourceopen", () => {
        this.sourceBuffer = this.mediaSource.addSourceBuffer(
          "video/webm; codecs=vp8"
        );
      });
    },
    async startStream() {
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia(
        this.displayMediaOptions
      );

      this.recordMedia();
      this.streamControls.streamAction = this.stopStream;
      this.streamControls.streamButtonText = "Остановить показ экрана";
    },
    stopStream() {
      this.mediaRecorder.stop();
      this.mediaStream = null;
      this.mediaRecorder = null;
      this.streamControls.streamAction = this.startStream;
      this.streamControls.streamButtonText = "Показать экран";

      this.videoServerConnection.emit(
        "endStream",
        this.curSession.confirenceId
      );
    },
    async recordMedia() {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: "video/webm; codecs=vp8",
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        let enctiptData = await this.encrypt(await event.data.arrayBuffer());
        this.videoServerConnection.emit(
          "stream",
          this.curSession.confirenceId,
          enctiptData
        );
      };

      this.mediaRecorder.start(100);
    },
    async setStreamer(user) {
      this.videoServerConnection.emit(
        "setStreamer",
        this.curSession.confirenceId,
        user.login
      );

      await this.users.forEach((el) => {
        el.streamer = false;
      });

      user.streamerControls.action = this.returnStreamingRight;
      user.streamer = true;
    },
    returnStreamingRight(user) {
      if (user) {
        user.streamer = false;
      }
      this.videoServerConnection.emit(
        "returnStreamingRight",
        this.curSession.confirenceId
      );
    },
    async adminButton() {
      this.returnStreamingRight();
      await this.users.forEach((el) => {
        el.streamer = false;
      });
      this.startStream();
    },
    openFullScreen() {
      let video = document.querySelector(".viewer-wrapper");
      this.fullScreen = !this.fullScreen;
      if (this.fullScreen) {
        video.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    },
    voice() {
      if (!this.speaks) {
        this.recordVoice();
      } else {
        this.stopRecordVoice();
      }

      this.speaks = !this.speaks;
    },
    async recordVoice() {
      try {
        this.voiceMediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } catch (e) {
        if (e.message == "Requested device not found") {
          alert("Микрофон не найден");
        } else {
          alert("Разрешите доступ к микрофону");
        }
        return;
      }

      this.voiceMediaRecorder = new MediaRecorder(this.voiceMediaStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      this.voiceMediaRecorder.ondataavailable = async (event) => {
        let enctiptData = await this.encrypt(await event.data.arrayBuffer());
        this.videoServerConnection.emit(
          "voiceStream",
          this.curSession.confirenceId,
          enctiptData,
          this.curSession.login
        );
      };

      this.voiceMediaRecorder.start(100);
    },
    stopRecordVoice() {
      this.voiceMediaRecorder.stop();
      this.voiceMediaRecorder = null;
      this.voiceMediaStream = null;

      console.log(321);
      this.videoServerConnection.emit(
        "stopVoiceStream",
        this.curSession.confirenceId,
        this.curSession.login
      );
    },
  },
};
</script>

<style lang="scss" scoped>
.buttonPurple {
  margin: 0 !important;
}

.center {
  margin: 0 auto !important;
}

.wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: 20px;
}
.video-wrapper {
  width: 70%;
  height: 80%;
  position: relative;
}
.video {
  width: 100%;
  height: 100%;
  border-radius: 13px;
  background: #000;
}
.video-buttons {
  position: absolute;
  width: 100%;
  left: 0;
  bottom: 0;
  padding: 20px;
  opacity: 0;
  transition: 0.3s;
  display: flex;
  justify-content: center;
  column-gap: 50px;
  &:hover {
    opacity: 1;
  }
}
.menu {
  height: 80%;
  width: 20%;
  padding: 0;
}
.users-button {
  border-top-right-radius: 10px;
  border-top-left-radius: 10px;
  outline: none;
  width: 100%;
  border: 0;
  padding: 15px 10px;
  font-size: 16px;
  font-weight: bold;
  background: transparent;
  text-align: start;
  cursor: pointer;
  transition: 0.3s;
  position: relative;
  &.active::before {
    transform: rotate(-40deg);
  }
  &.active::after {
    transform: rotate(40deg);
  }
  &:hover {
    background: rgb(240, 240, 240);
  }
  &::before {
    content: "";
    position: absolute;
    right: 27px;
    top: 50%;
    width: 10px;
    height: 1px;
    background: #000;
    transform: rotate(40deg);
    transition: 0.3s;
  }
  &::after {
    content: "";
    position: absolute;
    right: 20px;
    top: 50%;
    width: 10px;
    height: 1px;
    background: #000;
    transition: 0.3s;
    transform: rotate(-40deg);
  }
}

.users {
  position: relative;
  max-height: 1px;
  overflow: auto;
  border-bottom: 1px solid #000;
  // transition: all  0.2s linear;
  &.active {
    max-height: 40%;
  }
}
.user {
  position: relative;
  padding: 15px 15px 15px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  .icon-wrapper {
    display: flex;
    column-gap: 20px;
  }
}

.user-data {
  display: flex;
  align-items: center;
}

.user__icon {
  width: 35px;
  height: 35px;
  border: 1px solid #000;
  border-radius: 50%;
  padding: 3px;
  margin-right: 10px;
}
.monitor {
  width: 25px;
  height: 25px;
  cursor: pointer;
}
.mikrophone {
  width: 20px;
  height: 20px;
  cursor: pointer;
}
.chat-wrapper {
  padding: 15px;
  width: 100%;
  box-sizing: border-box;
}
.chat {
  padding: 7px 0px;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  border: 1px solid #000;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.messages {
  width: 100%;
  overflow: auto;
  padding: 0 10px;
  margin-bottom: 20px;
  box-sizing: border-box;
}
.message {
  margin-bottom: 20px;
  &:last-child {
    margin-bottom: 0;
  }
  .message__login {
    font-weight: bold;
    margin: 0 0 5px 0;
  }
  .message__text {
    word-break: break-word;
    margin: 0;
  }
}

.message-form {
  display: flex;
  align-items: center;
  padding: 10px;
}

textarea {
  width: calc(100% - 50px);
  max-height: 75px;
  min-height: 50px;
  resize: none;
  padding: 5px;
  border: 1px solid #000;
}
.send-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  padding: 10px;
  display: inline;
  position: relative;
  background-image: url("./../assets/img/send_message_arrow.png");
  background-position: center;
  background-repeat: no-repeat;
}

.user-sound {
  background-image: url("./../assets/img/microphon_white_On.svg");
  background-position: center;
  background-repeat: no-repeat;
  border-radius: 50%;
  background-size: 30px;
  &.active {
    background-image: url("./../assets/img/microphon_white_Off.svg");
  }
}

@media screen and (max-width: 1230px) {
  .wrapper {
    flex-direction: column;
  }
  .video-wrapper {
    width: 80%;
    height: 50%;
  }
  .video {
    border-radius: 0;
  }
  .menu {
    width: 80%;
    height: 50%;
    max-width: 100%;
    border-radius: 0;
  }
}

@media screen and (max-width: 850px) {
  .wrapper {
    flex-direction: column;
  }
  .video-wrapper {
    width: 100%;
    height: 50%;
    max-width: 700px;
  }
  .video {
    border-radius: 0;
  }
  .menu {
    width: 100%;
    border-radius: 0;
    height: 50%;
    max-width: 100%;
    max-width: 700px;
  }
}
</style>