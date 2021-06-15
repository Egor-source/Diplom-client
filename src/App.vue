<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
import bgAnimation from "@/js/bgAnimations";
import { baseServerUrl } from "./main";

export default {
  async mounted() {
    //Анимация заднего фона
    bgAnimation({
      colorStart: "#4c004c",
      colorStop: "#1a001a",
      bubbleFunc: () =>
        `hsla(${Math.random() * 360}, 100%, 50%, ${Math.random() * 0.25})`,
    });

    let sessions = JSON.parse(localStorage.getItem("sessionsData"));

    if (sessions && sessions.length>0) {
      let conferancesId = sessions.map((session) => session.confirenceId);

      let response = await fetch(
        `${baseServerUrl}/api/session/CheckLocalStorage`,
        {
          method: "POST",
          body: JSON.stringify(conferancesId),
          headers: { "Content-Type": "application/json" },
        }
      );

      let existingСonferences = await response.json();


      if (existingСonferences.length>0) {
        sessions = sessions.filter(
          (session) =>{
             if( existingСonferences.indexOf(session.confirenceId) != -1)
             {
               return session;
             }
          }
        );
        localStorage.setItem("sessionsData",JSON.stringify(sessions));
      } else {
        localStorage.removeItem("sessionsData");
      }
    }
  },
};
</script>


