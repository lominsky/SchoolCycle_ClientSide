//Displays the main screen and hides the login button
function displayMain(USER) {
  // console.log("displayMain()");
  processUser(USER);
  let DOMAIN = user.email;
  DOMAIN = DOMAIN.substring(DOMAIN.indexOf("@") + 1);
  database.ref("/users/" + safeDomain(DOMAIN) + "/" + user.uid).once("value", (snapshot) => {
    if(snapshot.val() == null) {
      database.ref("/users/" + safeDomain(DOMAIN) + "/" + user.uid).set({
        email: user.email,
        name: user.displayName,
        uid: user.uid,
        account_created: (new Date).getTime()
      })
    }
  });
    
  database.ref("/domain/" + safeDomain(DOMAIN)).once("value", (snapshot) => {
    domain = snapshot.val();
    if(domain == null) {
      return false;
    }
    domain.name = DOMAIN;
    processDomainData();
  }, (error) => {
    if(error.code == "PERMISSION_DENIED") {
      $("#expiredModal").modal("show");
    }
  });
  $('#loginModule').hide();
  $('#loggedInAs').text(user.displayName);
  $('#loggedInAsImage').attr("src", user.photoURL);
  $('#logoutModule').show();
}

function processUser(USER) {
  // console.log("processUser()");
  let safeD = safeDomain(USER.email)
  let now = new Date()
  let u = {
    name: USER.displayName,
    email: USER.email,
    domain: safeD,
    uid: USER.uid,
    account_created: firebase.database.ServerValue.TIMESTAMP,
    last_login: firebase.database.ServerValue.TIMESTAMP
  }

  let users = database.ref('users/' + u.domain + "/" + u.uid);
  users.once('value', (snapshot) => {
    const data = snapshot.val();
    if(data == null) {
      users.set(u).then(() => {
        log("Created new user: " + JSON.stringify(u));
      }).catch((error) => {
        log("Failed to create user: " + JSON.stringify(u) + ". Error: " + JSON.stringify(error));
      });
    } else {
      user.schedules = data.schedules;
      database.ref('users/' + u.domain + '/' + u.uid + '/last_login').set(firebase.database.ServerValue.TIMESTAMP);
      // updateScheduleDropDown()
    }
  });
  
  let d = database.ref('domain/' + safeD);
  d.once('value', (snapshot) => {
    const data = snapshot.val();
    if(data == null) {
      d.set({
        administrators: "",
        expiration: now.getTime() - 1000*60*60*48,
        cycle_calendar_id: "",
        cycle_days: "",
        default_schedules: ""
      }).then(() => {
        log("Created new domain: " + fbUnsafe(safeD));
      }).catch((error) => {
        log("Failed to create new domain: " + fbUnsafe(safeD) + ". Error: " + JSON.stringify(error));
      });
    }
  }, (error) => {
    if(error.code == "PERMISSION_DENIED") {
      d.set({
        administrators: "",
        expiration: now.getTime() - 1000*60*60*48,
        cycle_calendar_id: "",
        cycle_days: "",
        default_schedules: ""
      }).then(() => {
        log("Created new domain: " + fbUnsafe(safeD));
      }).catch((error) => {
        log("Failed to create new domain: " + fbUnsafe(safeD) + ". Error: " + JSON.stringify(error));
      });
    }
  });
}

function processDomainData() {
  // console.log("processDomainData()");
  let expiration = new Date(domain.expiration);
  if(expiration < (new Date())) {
    $("#expiredModal").modal("show");
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken('');
    }
    return false;
  }
  let scheds = Object.keys(domain.default_schedules);
  scheds = scheds.sort();
  $("#defaultSelector").empty()
  if(scheds.length == 0) {
    $("#multipleDefaultSchedules").text("Your school has not created any schedules. Check in with an administrator.");
  } else if (scheds.length == 1) {
    for(let sched of scheds) {
      let opt = $("<option>").text(fbUnsafe(sched))
      $("#defaultSelector").append(opt)
    }
    domain.selectedDefault = domain.default_schedules[scheds[0]];
  } else {
    $("#multipleDefaultSchedules").text("Your school has multiple possible schedules. Select the one that applies to you.");
    for(let sched of scheds) {
      let opt = $("<option>").text(fbUnsafe(sched))
      $("#defaultSelector").append(opt)
    }
    domain.selectedDefault = domain.default_schedules[scheds[0]];
  }
  
  let cycleDays = domain.cycle_days.split(", ").sort();
  $("#deleteTabDaySelector").empty();
  $("#deleteTabDaySelector").append($("<option data='all'>All Days</option>"));
  $("#deleteTabDaySelector").append($("<option data='cycle'>Cycle Days</option>"));
  $("#deleteTabDaySelector").append($("<option data='noncycle'>Non Cycle-Days</option>"));
  for(let day of cycleDays) {
    let option = $("<option data='day'></option>")
    option.text(day)
    $("#deleteTabDaySelector").append(option)
  }
  
  generateMultitable()
  defaultSelectorChanged();
}


function updateScheduleDropDown(selected) {
  // console.log("updateScheduleDropDown()")
  $("#schedulesDropDown").empty();
  let firstOpt = $("<option disabled>Saved Schedules</option>");
  if(selected == null) firstOpt.attr("selected", "selected")
  $("#schedulesDropDown").append(firstOpt)
  if(user.schedules == null) {
    user.schedules = {};
  }
  let schedules = Object.keys(user.schedules);
  for(let sched of schedules) {
    let opt = $("<option>").text(fbUnsafe(sched))
    if(fbUnsafe(sched) == selected) {
      opt.attr("selected", "selected");
    }
    if(domain.selectedDefault.sameTimes != user.schedules[sched].sameTimes) {
      opt.attr("disabled", "disabled")
    }
    $("#schedulesDropDown").append(opt)
  }
  schedulesDropDownChanged();
}

// Handle changes to the saved schedule dropdown. Mainly enabling or disabling buttons
function schedulesDropDownChanged() {
  if($('#schedulesDropDown').find(':selected').attr("disabled") == "disabled") {
    $("#loadSchedule").attr("disabled", "disabled");
    $("#saveSchedule").attr("disabled", "disabled");
    $("#deleteSchedule").attr("disabled", "disabled");
  } else {
    $("#loadSchedule").removeAttr("disabled");
    $("#saveSchedule").removeAttr("disabled");
    $("#deleteSchedule").removeAttr("disabled");
  }
}

function authCallback() {
  // console.log("authCallback()");
  displayMain(user);
  getCalendars();
  getCycleDays();
  
  let today = new Date();
  $("#startDateInput").val(timestampToInputDateString(today.getTime()));
  $("#startDateMulti").val(timestampToInputDateString(today.getTime()));
  $("#startDateDelete").val(timestampToInputDateString(today.getTime()));
  $("#startDateEdit").val(timestampToInputDateString(today.getTime()));
  let end = new Date(today.getTime() + 1000*60*60*24*365);
  $("#endDateInput").val(timestampToInputDateString(end.getTime()));
  $("#endDateMulti").val(timestampToInputDateString(end.getTime()));
  $("#endDateDelete").val(timestampToInputDateString(end.getTime()));
  $("#endDateEdit").val(timestampToInputDateString(end.getTime()));
  
  setSelectDisplayColor();
  
}

function getCalendars() {
  // console.log("getCalendars()")
  requestCalendars().then(
    function(values) { 
      updateCalendarSelectors(values);
    },
    function(error) { return error }
  );
}

function updateCalendarSelectors(calendars, selected) {
  console.log("updateCalendarSelectors()")
  calendars = calendars.sort((a,b) => { return a.summary - b.summary })
  // console.log(calendars);
  for(let cal of calendars) {
    console.log(cal.summary);
    let opt = $("<option>")
    opt.text(cal.summary)
    opt.attr("value", cal.id)
    if(selected == null && cal.primary == true) {
      opt.attr("selected", "true")
    } else if(selected == cal.id) {
      opt.attr("selected", "true")
    }
    $(".calendarSelector").append(opt);
  }
}

//Get the cycle days that are already in the calendar
function getCycleDays() {
  // console.log("getCycleDays()")
  let response;
  try {
    let now = new Date();
    let then = new Date(now.getTime() + 1000*60*60*24*365 + 1000*60*60*24*3)
    now = new Date(now.getTime() - 1000*60*60*24)
    const request = {
      'calendarId': domain.cycle_calendar_id,
      'timeMin': now.toISOString(),
      'timeMax': then.toISOString(),
      'maxResults': 1000,
      'showDeleted': false,
      'singleEvents': true,
      'orderBy': 'startTime',
    };
    gapi.client.calendar.events.list(request).then((response) => {
      domain.cycle_day_events = response.result.items
    });
  } catch (err) {
    log("getCurrentCycleDays() error.", err);
    return;
  }
}

function addEventsButton() {
  // console.log("addEventsButton()")

  let start = new Date($("#startDateInput").val())
  start = new Date(start.getTime() + start.getTimezoneOffset() * 1000 * 60)
  let end = new Date($("#endDateInput").val())
  end = new Date(end.getTime() + end.getTimezoneOffset() * 1000 * 60 + 1000*60*60*23 + 1000*60*59)
  
  if(start > end) {
    alert($("#manage-alert-container"), "End date is before start date.", "warning");
    return false
  }
  
  user.calId = $('#scheduleTabCalendarSelector').find(':selected').val()
  
  let date_range = [];
  for(let e of domain.cycle_day_events) {
    let d = new Date(e.start.date);
    d = new Date(d.getTime() + d.getTimezoneOffset() * 1000 * 60)
    let day = e.summary;
    if(d >= start && d <= end) {
      date_range.push({
        date: d,
        day: day
      });
    }
  }
  
    
  let entered_events = getTableValues();
  
  
  $('#populateModal').modal('show')
  
  user.potential_events = [];
  for(let date of date_range) {
    if(domain.selectedDefault.sameTimes) {
      let day_col = -1;
      for(let c = 2; c < entered_events[0].length; c++) {
        if(date.day == entered_events[0][c]) {
          day_col = c;
          break
        }
      }
      if(day_col == -1) {
        continue;
      }
      for(let slot = 1; slot < entered_events.length; slot++) {
        if(entered_events[slot][day_col] == "") continue;
        let title = entered_events[slot][day_col];
        let start = entered_events[slot][0];
        let end = entered_events[slot][1];
        let isoString = date.date.toISOString().substring(0, 10)
        user.potential_events.push({
          title: title,
          start: new Date(isoString + " " + start),
          end: new Date(isoString + " " + end),
          description: "",
          location: "",
          attendees: []
        })
      }
    } else {
      let day_table = -1;
      for(let t = 0; t < entered_events.length; t++) {
        if(date.day == entered_events[t][0][2]) {
          day_table = t;
          break
        }
      }
      if(day_table == -1) {
        continue;
      } 
      for(let slot = 1; slot < entered_events[0].length; slot++) {
        if(entered_events[day_table][slot][2] == "") continue;
        let title = entered_events[day_table][slot][2];
        let start = entered_events[day_table][slot][0];
        let end = entered_events[day_table][slot][1];
        let isoString = date.date.toISOString().substring(0, 10)
        user.potential_events.push({
          title: title,
          start: new Date(isoString + " " + start),
          end: new Date(isoString + " " + end),
          description: "",
          location: "",
          attendees: []
        })
      }
    }
  }
  
  $("#totalEvents").text("You are attempting to add " + user.potential_events.length + " events between " + start.toLocaleDateString() + " and " + end.toLocaleDateString() + " to the calendar '" + $('#scheduleTabCalendarSelector').find(':selected').text() + "'");
  // populateCalendar(potential_events, calId);
  
  getCurrentEvents(start, end).then(
    function(current_events) { 
      
      user.new_events = []
      
      for(let i in user.potential_events) {
        let potential_title = user.potential_events[i].title;
        let potential_start = user.potential_events[i].start;
        let potential_end = user.potential_events[i].end;
        let found = false;
        for(let j = 0; j < current_events.length; j++) {
          let current_title = current_events[j].summary;
          let current_start = new Date(current_events[j].start.dateTime);
          let current_end = new Date(current_events[j].end.dateTime);
          if(potential_title == current_title && potential_start.toISOString() == current_start.toISOString() && potential_end.toISOString() == current_end.toISOString()) {
            found = true;
            break;
          }
        }
        if(!found) {
          user.new_events.push(user.potential_events[i])
        }
      }
      if(user.potential_events.length != user.new_events.length) {
        $("#eligibleEvents").text("After ignoring duplicates, this will add " + user.new_events.length + " events to your calendar.")
      }
      if(user.new_events.length > 0) {
        $("#populateButton").removeAttr("disabled");   
      }
    },
    function(error) { return error }
  );
}

function populateCalendar() {
  // console.log("populateCalendar()");
  $("#populateButton").attr("disabled", "disabled")
  $("#addEventsButton").attr("disabled", "disabled")
  const batch = gapi.client.newBatch();
  for(let event of user.new_events) {
    let e = {
      'summary': event.title,
      'description': event.description,
      'location': event.location,
      'attendees': event.attendees,
      'start': {
        'dateTime': event.start.toISOString()
      },
      'end': {
        'dateTime': event.end.toISOString()
      },
      "extendedProperties": {
        "private": {
          "SchoolCycle": "event"
        }
      },
      "source": {
        "title": "SchoolCycle",
        "url": "https://schoolcycle.app"
      }
    };

    var request = gapi.client.calendar.events.insert({
      'calendarId': user.calId,
      'resource': e
    });

    batch.add(request);
  }
  batch.execute((es) => {
    let errorCount = 0;
    for(let i in es) {
      let e = es[i]
      if(e.error != null) {
        errorCount++;
        log("Error adding event to calendar.", e);
      }
    }
    if(errorCount == 0) {
      alert($("#manage-alert-container"), "Events successfully added to calendar.", "success", 5000);
    } else if (errorCount == user.new_events.length) {
      alert($("#manage-alert-container"), "Events failed to add.", "danger", 5000);
    } else {
      alert($("#manage-alert-container"), "Added " + (user.new_events.length-errorCount) + " out of " + user.new_events.length + " events. Please try again shortly.", "danger", 5000);
    } 
    
    $("#addEventsButton").removeAttr("disabled");  
    $("#populateButton").removeAttr("disabled");  
    $('#populateModal').modal('hide')
    $("#totalEvents").text("")
    $("#eligibleEvents").text("")
  });
}

//Get the events that are already in the calendar
async function getCurrentEvents(start, end, fromThisOnly=true, query=null) {
  // console.log("getCurrentEvents()")
  let response;
  try {
    const request = {
      'calendarId': user.calId,
      'timeMin': start.toISOString(),
      'timeMax': end.toISOString(),
      'privateExtendedProperty': 'SchoolCycle=event',
      'maxResults': 2500,
      'showDeleted': false,
      'singleEvents': true,
      'orderBy': 'startTime',
    };
    if(query) request.q = query
    if(!fromThisOnly) request.privateExtendedProperty = null;
    response = await gapi.client.calendar.events.list(request)
      return response.result.items;
  } catch (err) {
    log("getCurrentEvents() error.", err);
    return false;
  }
  return response.result.items
}

async function requestCalendars() {
  // console.log("requestCalendars()");
  let response;
  try {
    const request = {
      'minAccessRole': 'writer',
      'showHidden': true
    };
    response = await gapi.client.calendar.calendarList.list(request);
  } catch (err) {
    log("requestCalendars() error", err);
    return false;
  }
  return response.result.items;
}

function defaultSelectorChanged() {
  // console.log("defaultSelectorChanged()");
  let name = fbSafe($('#defaultSelector').find(':selected').text())
  domain.selectedDefault = domain.default_schedules[name];
  updateScheduleDropDown()
  generateScheduler();
}

//Displays the login button and hides everything else
function displayLogin() {
  // console.log("displayLogin()");
  $('#loginModule').show();
  $('#logoutModule').hide();
}

//Create the input grid for the schedule
function generateScheduler() {
  // console.log("generateScheduler()");
  $("#defaultScheduleDiv").empty();
  let cycleDays = domain.cycle_days.split(", ").sort();
  
  if(domain.selectedDefault == null) return false;
  
  const rows = domain.selectedDefault.sameTimes ? JSON.parse(domain.selectedDefault.entries).length - 1 : JSON.parse(domain.selectedDefault.entries)[0].length - 1;
  // if(!domain.selectedDefault.sameTimes) rows = JSON.parse(domain.selectedDefault.entries)[0].length - 1
  const columns = cycleDays.length + 2;
  // $("#sameTimeCheckbox").prop("checked", selectedDefault.sameTimes);
  
  if(domain.selectedDefault.sameTimes) {
    $("#differentTimesDayRadio").hide()
    let table = $('<table id="defaultScheduleTable" style="max-width:100%"></table>');
  
    // Create table header
    let headerRow = $("<tr>");
    for (let i = 0; i < columns; i++) {
      let headerCell = $("<th>");
      if(i == 0) {
        headerCell.text("Start Time");
      } else if(i == 1) {
        headerCell.text("End Time");
      } else {
        headerCell.text(cycleDays[i-2]);
      }
      headerRow.append(headerCell);
    }
    table.append(headerRow);

    // Create table data rows
    for (let i = 0; i < rows; i++) {
      const dataRow = $("<tr>");
      for (let j = 0; j < columns; j++) {
        const dataCell = $("<td>");
        const input = $("<input>");
        if(j < 2) {
          input.attr("type", "time");
          input.attr("class", "scheduler-time-input")
          input.addClass("grey")
        } else {
          input.attr("type", "text");
          dataCell.css("text-align", "center");
          input.css("width", "98%");
          input.addClass("schedule-tab-table-input")
        }
        input.attr("id", "schedule_cell-" + i + "-" + j);
        dataCell.append(input);
        dataRow.append(dataCell);
      }
      table.append(dataRow);
    } 
    $("#defaultScheduleDiv").append(table); 
  } else {   // Handle days with different timeslots
    $("#differentTimesDayRadio").show()
    $("#differentTimesDayRadio > div").empty();
    for(let i in cycleDays) {
      // let inputRadio = $('<input type="radio" class="btn-check" name="daySelectorRadio" id="dayRadio' + i + '" autocomplete="off">');
      // if(i == 0) inputRadio.attr("checked", "checked")
      // let label = $('<label class="btn btn-outline-primary" for="dayRadio' + i + '">' + cycleDays[i] + '</label>');
      // $("#differentTimesDayRadio > div").append(inputRadio, label);
      
      let row = $('<div class="row mb-3">')
      let col = $('<div class="col" style="text-align:center;">')
      
      let table = $('<table class="individualScheduleTable" style="max-width:100%"></table>');
      table.attr("day", cycleDays[i]);
      let headerRow = $("<tr><th>Start Time</th><th>End Time</th><th>" + cycleDays[i] + "</th></tr>");
      table.append(headerRow);

      // Create table data rows
      for (let i = 0; i < rows; i++) {
        const dataRow = $("<tr>");
        for (let j = 0; j < 3; j++) {
          const dataCell = $("<td>");
          const input = $("<input>");
          if(j < 2) {
            input.attr("type", "time");
            input.addClass("grey")
          } else {
            input.attr("type", "text");
            dataCell.css("text-align", "center");
            input.css("width", "98%");
          }
          dataCell.append(input);
          dataRow.append(dataCell);
        }
        table.append(dataRow);
      }
      col.append(table)
      row.append(col);
      $("#defaultScheduleDiv").append(row);
    }
    let input = $('<input type="radio" class="btn-check" name="daySelectorRadio" id="dayRadioAll" autocomplete="off">');
    let label = $('<label class="btn btn-outline-primary" for="dayRadioAll">All</label>');
    $("#differentTimesDayRadio > div").append(input, label);
  }
  populateDefaults()
  $("#manage-schedule-row").show();
}

function populateDefaults() {
  // console.log("populateDefaults()");
  let schedule = JSON.parse(domain.selectedDefault.entries)
  if(domain.selectedDefault.sameTimes) {
    let availableHeaders = domain.cycle_days.split(", ").sort();
    availableHeaders.unshift("End Time");
    availableHeaders.unshift("Start Time");
    let table = $("#defaultScheduleTable");
    let rows = $("#defaultScheduleTable").children();
    let savedHeaders = schedule[0]
    rows.each((y, e) => {
      if(y != 0) {
        $(e).children().each((x, el) => {
          let newX = savedHeaders.indexOf(availableHeaders[x]);
          if(newX != -1 && y < schedule.length) {
            if(newX < 2) {
              $(el).find("input").val(schedule[y][newX]);
            } else {
              $(el).find("input").attr("placeholder", schedule[y][newX]);
            }
          }
        })
      }
    })
  } else {
    let availableHeaders = domain.cycle_days.split(", ").sort();
    let tables = $(".individualScheduleTable");
    let savedHeaders = [];
    for(let t of schedule){
      savedHeaders.push(t[0][2]);
    }

    tables.each((i,t) => {
      let savedTableNumber = savedHeaders.indexOf(availableHeaders[i]);
      if(savedTableNumber != -1) {
        $(t).children().each((y, e) => {
          if(y < schedule[0].length) {
            $(e).children().each((x, el) => {
              if(x < 2) {
                $(el).find("input").val(schedule[savedTableNumber][y][x])
              } else {
                $(el).find("input").attr("placeholder", schedule[savedTableNumber][y][x])
              } 
            });
          }
        });
      }
    });
  }
  lockTimes();
}

function toggleLock() {
  // console.log("toggleLock()");
  if($("#lockTimes").text() == "Unlock Times") {
    unlockTimes();
  } else {
    lockTimes();
  }
}


function lockTimes() {
  // console.log("lockTimes()");
  $("input.scheduler-time-input").attr("disabled", "disabled")
  $("#lockTimes").text("Unlock Times")
}

function unlockTimes() {
  // console.log("unlockTimes()");
  $("input.scheduler-time-input").removeAttr("disabled")
  $("#lockTimes").text("Lock Times")
}

// Handler for the save as button that creates new saved schedules
function saveScheduleAs() {
  // console.log("saveScheduleAs()");
  $('#saveAsModal').modal('hide')
  let values = getTableValues();
  let name = fbSafe($("#scheduleNameInput").val());
  $("#scheduleNameInput").val("")
  if(name.length > 100) name = name.substring(0, 100);
  
  if(user.schedules != null) {
    let usedNames = Object.keys(user.schedules);
    if(usedNames.includes(name)) {
      alert($("#manage-alert-container"), "That name is already in use.", "warning");
      return false;
    }
  }
  
  database.ref('users/' + user.domain + "/" + user.uid + "/schedules" + "/" + name).set({
    entries: JSON.stringify(values),
    sameTimes: domain.selectedDefault.sameTimes
  })
  .then(() => {
    // log("Created new schedule: " + name)
    alert($("#manage-alert-container"), "Created new schedule: " + fbUnsafe(name), "success");
    if(user.schedules == null) user.schedules = {};
    user.schedules[name] = {
    entries: JSON.stringify(values),
    sameTimes: domain.selectedDefault.sameTimes
  };
    updateScheduleDropDown(name);
  })
  .catch((error) => {
    log("Failed to create user schedule: " + name, error);
    alert($("#manage-alert-container"), "Failed to create schedule: " + fbUnsafe(name), "warning");
  });
}

// Handle the load schedule button that fills the input table using saved values
function loadSchedule() {
  // console.log("loadSchedule()");
  let name = fbSafe($('#schedulesDropDown').find(':selected').val());
  let schedule = user.schedules[name];
  $("#sameTimeCheckbox").prop("checked", schedule.sameTimes);
  schedule = JSON.parse(schedule.entries);
  rowCount = schedule.length-2;
  generateScheduler();
  fillScheduleInputs(schedule);
}

function fillScheduleInputs(schedule) {
  if(domain.selectedDefault.sameTimes) {
    let availableHeaders = domain.cycle_days.split(", ").sort();
    availableHeaders.unshift("End Time");
    availableHeaders.unshift("Start Time");
    let table = $("#defaultScheduleTable");
    let rows = $("#defaultScheduleTable").children();
    let savedHeaders = schedule[0]
    rows.each((y, e) => {
      if(y != 0) {
        $(e).children().each((x, el) => {
          let newX = savedHeaders.indexOf(availableHeaders[x]);
          if(newX != -1 && y < schedule.length) {
            $(el).find("input").val(schedule[y][newX]);
          }
        })
      }
    })
  } else {
    let availableHeaders = domain.cycle_days.split(", ").sort();
    let tables = $(".individualScheduleTable");
    let savedHeaders = [];
    for(let t of schedule){
      savedHeaders.push(t[0][2]);
    }

    tables.each((i,t) => {
      let savedTableNumber = savedHeaders.indexOf(availableHeaders[i]);
      if(savedTableNumber != -1) {
        $(t).children().each((y, e) => {
          if(y < schedule[0].length) {
            $(e).children().each((x, el) => {
              $(el).find("input").val(schedule[savedTableNumber][y][x])
            });
          }
        });
      }
    });
  }
}


// Handler for the update button that overwrites existing schedules
function updateSchedule() {
  $('#updateModal').modal('hide')
  let values = getTableValues();
  let name = fbSafe($('#schedulesDropDown').find(':selected').val())
  
  database.ref('users/' + user.domain + "/" + user.uid + "/schedules" + "/" + name).set({
    entries: JSON.stringify(values),
    sameTimes: domain.selectedDefault.sameTimes
  })
  .then(() => {
    log("Updated schedule: " + name)
    alert($("#manage-alert-container"), "Updated schedule: " + fbUnsafe(name), "success");
    user.schedules[name] = {
    entries: JSON.stringify(values),
    sameTimes: domain.selectedDefault.sameTimes
  };
    updateScheduleDropDown(name);
  })
  .catch((error) => {
    log("Failed to create schedule: " + name, error);
    alert($("#manage-alert-container"), "Failed to update schedule: " + fbUnsafe(name), "warning");
  });
}

// Handler for the delete schedule button that removes saved schedules
function deleteSchedule() {
  $('#deleteModal').modal('hide')
  let name = fbSafe($('#schedulesDropDown').find(':selected').val())
  
  database.ref('users/' + user.domain + "/" + user.uid + "/schedules" + "/" + name).set({})
  .then(() => {
    log("Deleted schedule: " + name)
    alert($("#manage-alert-container"), "Deleted schedule: " + fbUnsafe(name), "success");
    delete user.schedules[name];
    updateScheduleDropDown();
  })
  .catch((error) => {
    log("Failed to delete schedule: " + name, error);
    alert($("#manage-alert-container"), "Failed to delete schedule: " + fbUnsafe(name), "warning");
  });
}





/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

                                    Multi Tab
  
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

function frequencySelectChanged() {
  // console.log("frequencySelectChanged()");
  let frequency = parseInt($("#frequencySelect").find(':selected').attr("value"))
  let periods = [
    [{
      text: "Every Cycle",
      value: 0
    }],
    [{
      text: "Even Cycles",
      value: 0
    }, {
      text: "Odd Cycles",
      value: 1
    }],
    [{
      text: "Cycles 1, 4, 7, etc",
      value: 1
    }, {
      text: "Cycles 2, 5, 8, etc",
      value: 2
    }, {
      text: "Cycles 3, 6, 9, etc",
      value: 0
    }],
    [{
      text: "Cycles 1, 5, 9, etc",
      value: 1
    }, {
      text: "Cycles 2, 6, 10, etc",
      value: 2
    }, {
      text: "Cycles 3, 7, 11, etc",
      value: 3
    }, {
      text: "Cycles 4, 8, 12, etc",
      value: 0
    }],
  ]
  let period = periods[frequency]
  $("#frequencyCycleSelect").empty()
  for(let p of period) {
    let option = $("<option>");
    option.text(p.text);
    option.attr("value", p.value);
    // console.log(option);
    $("#frequencyCycleSelect").append(option);
  }
}


//Create the input grid for the multicyclic tab
function generateMultitable() {
  // console.log("generateMultitable()");
  $("#multiScheduleDiv").empty();
  let table = $('<table id="multiScheduleTable" style="max-width:100%"></table>');
  
  // Create table header
  let headerRow = $("<th>Day</th><th>Start</th><th>End</th><th>Title</th><th>Description</th><th>Location</th><th>Guests</th>");
  table.append(headerRow);

  // Create table data rows
  for (let i = 0; i < 10; i++) {
    const dataRow = $("<tr>");const dayCell = $("<td>")
    const daySelect = $("<select class='daySelect multicycle-day' row='" + i + "' id='multi_cell_day-" + i + "'>")
    let days = domain.cycle_days.split(", ")
    for(let day of days) {
      let option = $("<option>")
      option.text(day)
      daySelect.append(option)
    }
    dayCell.append(daySelect)
    const startCell = $("<td><input type='time' class='multicycle-start' id='multi_cell_start-" + i + "'></td>")
    const endCell = $("<td><input type='time' class='multicycle-end' id='multi_cell_end-" + i + "'></td>")
    const titleCell = $("<td><input type='text' class='multicycle-title' id='multi_cell_title-" + i + "'></td>")
    const descriptionCell = $("<td><input type='text' class='multicycle-description' id='multi_cell_description-" + i + "'></td>")
    const locationCell = $("<td><input type='text' class='multicycle-location' id='multi_cell_location-" + i + "'></td>")
    const guestsCell = $("<td><input type='text' class='multicycle-guests' id='multi_cell_guests-" + i + "'></td>")
    dataRow.append(dayCell, startCell, endCell, titleCell, descriptionCell, locationCell, guestsCell);
    table.append(dataRow);
  } 
  $("#multiScheduleDiv").append(table); 
}

function getMultiTable() {
  // console.log("getMultiTable()")
  let days = $(".multicycle-day");
  let starts = $(".multicycle-start");
  let ends = $(".multicycle-end");
  let titles = $(".multicycle-title");
  let descriptions = $(".multicycle-description");
  let locations = $(".multicycle-location");
  let guests = $(".multicycle-guests");
  
  let rows = []
  
  for(let i = 0; i < days.length; i++) {
    let day = $(days[i]).find(":selected").text()
    let start = $(starts[i]).val()
    let end = $(ends[i]).val()
    let title = $(titles[i]).val()
    if(title == "") continue;
    let description = $(descriptions[i]).val()
    let location = $(locations[i]).val()
    let guest = $(guests[i]).val()
    
    if(start == "" || end == "") {
      alert($("#manage-alert-container"), "Make sure every event has a valid start and end time.", "danger");
      return false;
    }
    let now = new Date()
    if((new Date(now.toLocaleDateString() + " " + start)) >= (new Date(now.toLocaleDateString() + " " + end))) {
      alert($("#manage-alert-container"), "Make sure every event's end time is later than it's start time.", "danger");
      return false;
    }
    
    const regex = /.+@.+\..+/g;
    let guest_emails = [];
    if(guest != "") {
      for(let g of guest.split(",")) {
        g = g.trim();
        let found = g.match(regex);
        if(found == null || found.length < 1 || found[0] != g) {
          alert($("#manage-alert-container"), "Guests must be entered as comma separated email addresses.", "danger");
          return false;
        } 
        if(!guest_emails.includes(g)) {
          guest_emails.push(g);
        }
      }
    }
    for(let i = 0; i < guest_emails.length; i++) {
      guest_emails[i] = {"email": guest_emails[i]}
    }
    
    rows.push({
      day: day, 
      start: start, 
      end: end, 
      title: title, 
      description: description, 
      location: location, 
      guests: guest_emails
    })
  }
  return rows
  
}

function addMultiEventsButton() {
  // console.log("addMultiEventsButton()")

  let start = new Date($("#startDateMulti").val())
  start = new Date(start.getTime() + start.getTimezoneOffset() * 1000 * 60)
  let end = new Date($("#endDateMulti").val())
  end = new Date(end.getTime() + end.getTimezoneOffset() * 1000 * 60 + 1000*60*60*23 + 1000*60*59)
  
  if(start > end) {
    alert($("#manage-alert-container"), "End date is before start date.", "danger");
    return false
  }
  
  user.calId = $('#multiCalendarSelector').find(':selected').val()
  
  let date_range = [];
  for(let e of domain.cycle_day_events) {
    let d = new Date(e.start.date);
    d = new Date(d.getTime() + d.getTimezoneOffset() * 1000 * 60)
    let day = e.summary;
    if(!e.description) continue;
    if(e.description.length < 7) continue;
    if(e.description.substring(0, 6) != "Cycle ") continue;
    if(e.description.substring(6) == NaN) continue;
    let cycle = parseInt(e.description.substring(6))
    if(d >= start && d <= end) {
      date_range.push({
        date: d,
        day: day,
        cycle: cycle
      });
    }
  }
  
  let entered_events = getMultiTable();
  if(entered_events == false) return false;
  
  let divisor = parseInt($("#frequencySelect").find(':selected').attr("value"))+1;
  let remainder = parseInt($("#frequencyCycleSelect").find(':selected').attr("value"));
  
  $('#populateModal').modal('show')
  
  user.potential_events = [];
  for(let date of date_range) {
    for(let event of entered_events) {
      if(date.cycle % divisor != remainder) continue;
      if(event.day !== date.day) continue;
      let isoString = date.date.toISOString().substring(0, 10)
      user.potential_events.push({
        title: event.title,
        start: new Date(isoString + " " + event.start),
        end: new Date(isoString + " " + event.end),
        description: event.description,
        location: event.location,
        attendees: event.guests
      })
    }
  }
  $("#totalEvents").text("You are attempting to add " + user.potential_events.length + " events between " + start.toLocaleDateString() + " and " + end.toLocaleDateString() + ".");
  
  getCurrentEvents(start, end).then(
    function(current_events) { 
      
      user.new_events = []
      
      for(let i in user.potential_events) {
        let potential_title = user.potential_events[i].title;
        let potential_start = user.potential_events[i].start;
        let potential_end = user.potential_events[i].end;
        let found = false;
        for(let j = 0; j < current_events.length; j++) {
          let current_title = current_events[j].summary;
          let current_start = new Date(current_events[j].start.dateTime);
          let current_end = new Date(current_events[j].end.dateTime);
          if(potential_title == current_title && potential_start.toISOString() == current_start.toISOString() && potential_end.toISOString() == current_end.toISOString()) {
            found = true;
            break;
          }
        }
        if(!found) {
          user.new_events.push(user.potential_events[i])
        }
      }
      if(user.potential_events.length != user.new_events.length) {
        $("#eligibleEvents").text("After ignoring duplicates, this will add " + user.new_events.length + " events to your calendar.")
      }
      if(user.new_events.length > 0) {
        $("#populateButton").removeAttr("disabled");   
      }
    },
    function(error) { return error }
  );
}




/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

                                    Edit Tab
  
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


function getEventsToEdit() {
  // console.log("getEventsToEdit()")

  let start = new Date($("#startDateEdit").val())
  start = new Date(start.getTime() + start.getTimezoneOffset() * 1000 * 60)
  let end = new Date($("#endDateEdit").val())
  end = new Date(end.getTime() + end.getTimezoneOffset() * 1000 * 60 + 1000*60*60*23 + 1000*60*59)
  user.calId = $('#editTabCalendarSelector').find(':selected').val()

  
  
  getCurrentEvents(start, end, false).then(
    function(current_events) { 
      user.editable_events = {}
      
      for(let i in current_events) {
        let title = current_events[i].summary;
        if(user.editable_events[title] == null) user.editable_events[title] = [];
        user.editable_events[title].push(current_events[i])
      
      }
      
      $("#editTabEventSelector").empty();
      $("#editTabEventSelector").append($("<option disabled>Select Event</option>"));
      let editable = Object.keys(user.editable_events);
      editable = editable.sort()
      for(let event of editable) {
        if(user.editable_events[event].length < 2) continue;
        let option = $("<option></option>")
        option.text(event)
        $("#editTabEventSelector").append(option)
      }
    },
    function(error) { return error }
  );
  
  $("#editEventsButton").removeAttr("disabled"); 
}

$("#edit_color_select").on( "change", setSelectDisplayColor);

function setSelectDisplayColor() {
  $("#edit_color_select").css({ 'background-color': $("#edit_color_select").find(':selected').attr("data"), 'color': 'white'});
}

function batchEventEdits() {
  // console.log("batchEventEdits()")
  
  let start = new Date($("#startDateEdit").val())
  start = new Date(start.getTime() + start.getTimezoneOffset() * 1000 * 60)
  let end = new Date($("#endDateEdit").val())
  end = new Date(end.getTime() + end.getTimezoneOffset() * 1000 * 60 + 1000*60*60*23 + 1000*60*59)
  user.calId = $('#editTabCalendarSelector').find(':selected').val()
  let eventToEdit = $('#editTabEventSelector').find(':selected').val()
  
  let changes = {}
  
  if($("#edit_title_checkbox").is(":checked")) changes.summary = $("#edit_title_input").val()
  if($("#edit_starttime_checkbox").is(":checked")) changes.start = $("#edit_starttime_input").val()
  if($("#edit_endtime_checkbox").is(":checked")) changes.end = $("#edit_endtime_input").val()
  if($("#edit_description_checkbox").is(":checked")) changes.description = $("#edit_description_input").val()
  if($("#edit_location_checkbox").is(":checked")) changes.location = $("#edit_location_input").val()
  if($("#edit_guests_checkbox").is(":checked")) changes.attendees = $("#edit_guests_input").val()
  if($("#edit_color_checkbox").is(":checked")) changes.colorId = $("#edit_color_select").find(':selected').val()
  if($("#edit_transparency_checkbox").is(":checked")) changes.transparency = $("#edit_transparency_select").find(':selected').val()
  if($("#edit_visibility_checkbox").is(":checked")) changes.visibility = $("#edit_visibility_select").find(':selected').val()
  
  if(changes.summary == "") {
    alert($("#manage-alert-container"), "The title cannot be blank.", "warning");
      return false;
  }
  if(changes.start == "") {
    alert($("#manage-alert-container"), "The start time cannot be blank.", "warning");
      return false;
  }
  if(changes.end == "") {
    alert($("#manage-alert-container"), "The end time cannot be blank.", "warning");
      return false;
  }
  
  
  if(changes.start && changes.end) {
    let now = new Date();
    if((new Date(now.toLocaleDateString() + " " + changes.start)) >= (new Date(now.toLocaleDateString() + " " + changes.end))) {
      alert($("#manage-alert-container"), "The start time must be earlier than the end time.", "warning");
      return false;
    }
  }
  
  if(changes.attendees) {
    const regex = /.+@.+\..+/g;
    let guest_emails = [];
    for(let g of changes.attendees.split(",")) {
      g = g.trim();
      let found = g.match(regex);
      if(found == null || found.length < 1 || found[0] != g) {
        alert($("#manage-alert-container"), "Guests must be entered as comma separated email addresses.", "warning");
        return false;
      } 
      if(!guest_emails.includes(g)) {
        guest_emails.push(g);
      }
    }
    for(let i = 0; i < guest_emails.length; i++) {
      guest_emails[i] = {"email": guest_emails[i]}
    }
    changes.attendees = guest_emails;
  } else if(changes.attendees == "") {
    changes.attendees = []
  }
  
  getCurrentEvents(start, end, false, eventToEdit).then(
    function(current_events) { 
      user.batch_edit = gapi.client.newBatch();
      user.to_edit = current_events;
      user.to_edit_changes = changes;
      for(let event of current_events) {

        gapi.client.calendar.events.get({"calendarId": user.calId, "eventId": event.id}).then((e) => {
          let d = e.result;
          
          if(changes.summary) d.summary = changes.summary;
          if(changes.description != null) d.description = changes.description;
          if(changes.location != null) d.location = changes.location;
          if(changes.attendees) d.attendees = changes.attendees;
          if(changes.colorId) d.colorId = changes.colorId;
          if(changes.transparency) d.transparency = changes.transparency;
          if(changes.visibility) d.visibility = changes.visibility;
          if(changes.start) d.start.dateTime = (new Date((new Date(d.start.dateTime)).toLocaleDateString() + " " + changes.start)).toISOString();
          if(changes.end) d.end.dateTime = (new Date((new Date(d.end.dateTime)).toLocaleDateString() + " " + changes.end)).toISOString();
          if((new Date(d.start.dateTime) >= (new Date(d.end.dateTime)))) {
            alert($("#manage-alert-container"), "Start time must come before end time.", "warning");
              return false;
          }
          d.source = {
            "title": "SchoolCycle",
            "url": "https://schoolcycle.app"
          }
          let request = gapi.client.calendar.events.patch({
            'calendarId': user.calId,
            'eventId': d.id,
            'resource': d
          });
          
          user.batch_edit.add(request);
        })
        //Update the edit modal
        $("#editedEventsCount").text("Updating " + user.to_edit.length + " events with the title '" + eventToEdit + "'")
        if(Object.keys(user.to_edit_changes).length == 0) {
          $('#editedEventsUpdates').text("You must select at least one property to update.")
        } else  {
          $('#editedEventsUpdates').text("")
        }

        if(user.to_edit.length > 0 && Object.keys(user.to_edit_changes).length > 0) {
          $("#confirmEditButton").removeAttr("disabled"); 
        }
        
        $('#editModal').modal('show')
      }
      
    },
    function(error) { return error }
  );
  
}

function runBatchedEdits() {
    $("#confirmEditButton").attr("disabled", "disabled");
    user.batch_edit.execute((es) => {
    let errorCount = 0;
    for(let i in es) {
      let e = es[i]
      if(e.error != null) {
        errorCount++;
        log("Error editing events.", e);
      }
    }
    if(errorCount == 0) {
      alert($("#manage-alert-container"), "Events successfully updated.", "success", 5000);
    } else if (errorCount == user.to_delete.length) {
      alert($("#manage-alert-container"), "Events failed to update.", "danger", 5000);
    } else {
      alert($("#manage-alert-container"), "Updated " + (user.to_edit.length-errorCount) + " out of " + user.to_edit.length + " events. Please try again shortly.", "danger", 5000);
    } 
    
    $('#editModal').modal('hide');
    getEventsToEdit();
  });
}



/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

                                    Delete Tab
  
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


function getEventsToDelete() {
  // console.log("getEventsToDelete()")

  let start = new Date($("#startDateDelete").val())
  start = new Date(start.getTime() + start.getTimezoneOffset() * 1000 * 60)
  let end = new Date($("#endDateDelete").val())
  end = new Date(end.getTime() + end.getTimezoneOffset() * 1000 * 60 + 1000*60*60*23 + 1000*60*59)
  user.calId = $('#deleteTabCalendarSelector').find(':selected').val()
  
  
  getCurrentEvents(start, end, false).then(
    function(current_events) { 
      user.deletable_events = {}
      
      for(let i in current_events) {
        let title = current_events[i].summary;
        
        let day = null;
        for(let cycle_day of domain.cycle_day_events) {
          let current_event_date;
          if(current_events[i].start.dateTime != null) {
            current_event_date = current_events[i].start.dateTime.split("T")[0]
          } else {
            current_event_date = current_events[i].start.date
          }
          if(cycle_day.start.date == current_event_date) {
            day = cycle_day.summary;
            break;
          }
        }
        
        if(user.deletable_events[title] == null) user.deletable_events[title] = [];
        user.deletable_events[title].push({
          id: current_events[i].id,
          day: day
        })
      
      }
      
      $("#deleteTabEventSelector").empty();
      $("#deleteTabEventSelector").append($("<option data='all'>All Events</option>"));
      let deletable = Object.keys(user.deletable_events);
      deletable = deletable.sort()
      for(let event of deletable) {
        if(user.deletable_events[event].length < 2) continue;
        let option = $("<option data='event'></option>")
        option.text(event)
        $("#deleteTabEventSelector").append(option)
      }
      $('#deleteTabEventSelector').removeAttr("disabled");
    },
    function(error) { return error }
  );
}

function deleteEventsModal() {
  // deleteQueryData
  let selectedEvent = $('#deleteTabEventSelector').find(':selected')
  let selectedDay = $('#deleteTabDaySelector').find(':selected')
  let queryString = "You are deleting all events ";
  if(selectedEvent.attr("data") != "all") {
    queryString += "with the title '" + selectedEvent.text() + "' "
  }
  queryString += "on every "
  if(selectedDay.attr("data") == "all") {
    queryString += "day"
  } else if(selectedDay.attr("data") == "cycle") {
    queryString += "cycle day"
  } else if(selectedDay.attr("data") == "noncycle") {
    queryString += "non-cycle day"
  } else {
    queryString += " " + selectedDay.text()
  }
  
  let start = new Date($("#startDateDelete").val())
  start = new Date(start.getTime() + start.getTimezoneOffset() * 1000 * 60)
  let end = new Date($("#endDateInput").val())
  end = new Date(end.getTime() + end.getTimezoneOffset() * 1000 * 60 + 1000*60*60*23 + 1000*60*59)
  queryString += " between " + start.toLocaleDateString() + " and " + end.toLocaleDateString() + " from your calendar '" + $('#deleteTabCalendarSelector').find(':selected').text() + "'."
  $("#deleteQueryData").text(queryString);
  
    

  let tempDelete = [];
  if(selectedEvent.attr("data") == "all") {
    for(let e in user.deletable_events) {
      for(let d of user.deletable_events[e]) {
        tempDelete.push(d);
      }
    }
  } else {
    for(let d in user.deletable_events[selectedEvent.text()]) {
      tempDelete.push(user.deletable_events[selectedEvent.text()][d]);
    }
  }
  user.to_delete = [];

  
  for(let e of tempDelete) {
    if(selectedDay.attr("data") == "all") {
      user.to_delete.push(e.id)
    } else if(selectedDay.attr("data") == "cycle" && e.day != null) {
      user.to_delete.push(e.id)
    } else if(selectedDay.attr("data") == "noncycle" && e.day == null) {
      user.to_delete.push(e.id)
    } else if(e.day == selectedDay.text()) {
      user.to_delete.push(e.id)
    }
  }
  
    //deleteCountData
  let countString = "That is " + user.to_delete.length + " events. Press 'Delete' to continue.";
  $("#deleteCountData").text(countString);
  $("#deleteEventsButton").removeAttr("disabled");
  
  $('#deleteEventModal').modal('show')
}

function deleteEvents() {
  // console.log("deleteEvents()");
  $("#deleteTabDeleteButton").attr("disabled", "disabled")
  $("#deleteEventsButton").attr("disabled", "disabled")
  const batch = gapi.client.newBatch();
  for(let event of user.to_delete) {
    var request = gapi.client.calendar.events.delete({
      'calendarId': $('#deleteTabCalendarSelector').find(':selected').attr('value'),
      'eventId': event,
      'resource': {
        'sendUpdates': "none"
      }
    });

    batch.add(request);
  }
  batch.execute((es) => {
    let errorCount = 0;
    for(let i in es) {
      let e = es[i]
      if(e.error != null) {
        errorCount++;
        log("Error deleting event from calendar.", e);
      }
    }
    if(errorCount == 0) {
      alert($("#manage-alert-container"), "Events successfully deleted from calendar.", "success", 5000);
    } else if (errorCount == user.to_delete.length) {
      alert($("#manage-alert-container"), "Events failed to delete.", "danger", 5000);
    } else {
      alert($("#manage-alert-container"), "Deleted " + (user.to_delete.length-errorCount) + " out of " + user.to_delete.length + " events. Please try again shortly.", "danger", 5000);
    } 
    
    $("#deleteTabDeleteButton").removeAttr("disabled");  
    $("#deleteEventsButton").removeAttr("disabled");  
    $('#deleteEventModal').modal('hide')
    getEventsToDelete();
  });
}