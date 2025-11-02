document.getElementById("btn").addEventListener("click", () => {
  alert("the button is buttoning, how cool!");
});

const subscribeBtn = document.getElementById("btn2");
if (subscribeBtn)
  subscribeBtn.addEventListener("click", () => {
    window.location.href = "https://www.youtube.com/@COOLmanGamer?sub_confirmation=1";
  });