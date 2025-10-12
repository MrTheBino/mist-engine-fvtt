# CHANGELOG

# 0.3.12
- added the posibility to add tags & statuses to the short description of challenges
- compendium entry for Statuses provided by Markus Raab
  
# 0.3.11
- Backpack section of character sheet (edit mode): The fields have become smaller, and the trash bin icon is displayed in white #16
- added basic documentation
- added themebooks as compendium, only their name without the actual content from the book got added
  
# 0.3.10
- just a version bump
  
# 0.3.9
- Change Request: Label the "Legend in the Mist NPC" as "Legend in the Mist Challenge" instead #14
- Feature: On the NPC Sheet in Edit mode for Threats & Consequences offer the possibility to delete consequence lines again
- Change Request: larger description field on the items #12
- Change Request: Legend in the Mist NPC sheet should be able to display Immunities in the Limit section #13

# 0.3.8
- Refined character theme card styling
- backpack items drag and drop between different character sheets, the backpack item in the source character doesn't get deleted on purpose
  
# 0.3.7
- GHI: Change Request: Smaller icon on the themebook sheet #8
- GHI: Themebook Description: White text on bright background & copied text cannot be saved #7
- Added tag/status drop to scene data app
- Added border image to scene data app
  
# 0.3.6
- improved handling status / tags acording to the rules (takes +- of hightest tier status) (Page 69 of LITM, Making a Roll)
- improved UX
- scene tag app: GM can toggle dice roll mods between positive and negative, story tags can be selected by the gm for the next roll of a character
- only used tags / statuses during a roll are shown in the chat windows

# 0.3.5
- improved internal handling of fellowship theme cards
- selecting tags doesn't send always a fellowship changed signal

# 0.3.4
- fixed entering / saving the quest for the fellowship themecard

# 0.3.3
- improved internal handling of fellowship theme cards

# 0.3.2
- styling fixes
- correct permission management in the scene tags window / app
- stopped prevent edit mode toggling via submiting / editing data via the ENTER key
- fixed some small bugs for the scene tags app

# 0.3.1
- fellowship themecard actors are linked now per default

# 0.3
- UI improvements
- tags & status handling improved
- many bug fixes
- consolidated code 
- etc... first BETA release
  
# 0.2.11
- added more powertags & weakness fields to the themebooks
  
# 0.2.10
- addes special improvements for themebooks and fellowship themecards
- fixed nasty bug in fellowship themecard assignment
- started merging general code functions in helper classes
- scene tags app can now updated the tags & statuses of characters (markings and type)
- many small bug fixes
 
# 0.2.9
- simplified tag & status behaviour in character and npc sheets
  
# 0.2.8
 - create quintessence fix in the character sheet
 - creating a new status switches directly to edit mode for statuses

# 0.2.7
- Ctrl-J opens the scene tag window
- added tags and statuses to journals which can be dragged to actors, In a page you can use the following text: [tag] [status-value] [-limit:value] thanks to 3rddogpaul
- tags & statuses of characters are getting show in the scene tags window. Only if the characters are in the current activated scene
  
# 0.2.6
- quintessences are now items, hover over the quintessence name and you will see the description for easier referencing
- added markiers for statuses
- moved tags & status to the right side of the sheets
- bug fixes here and there
- Ctrl-T opens the scene tag window
  
# 0.2.5
- fixed scrolling issues in NPC and character sheets
  
# 0.2.4
 - drag'n'drop of tags & status from NPCs to characters, thanks to 3rddogpaul
 - started implementing fellowship themecards, needs some heavy testing
 - started to restructure some things, to shape things up and to be able to use them as components
 - help texts for empty messages
 - many bugfixes
 - fixed weakness tag typo, all weakness texts must be entered again if you are already using the system
 - added weakness tag edit lines in themebooks for the questions

# 0.2.3
- automaticly link character actor data to the token
  
## 0.2.2
- slighty improved editing of npc sheet
- improved slighty visual styles
- fixed dice roll results
- added fumble and critical roll indicators  (needs styling and altered output in the chat window)
- fixed special feature rending on npc sheets
- fellowship relation tags can be used in rolls
- visual indicator via mouse over on selectable tags

## 0.2.1
- all new characters are getting a backpack assigned per default
- weakness in themebooks got a colored border to better identify them
- moved dice roll results to language file in lang/en.json
- improved slightly some styling
- fixes here and there
- first powertag in a themebook is bolder now to highlight it
- still a lot to do especially on the styling part

## 0.2

- scene window dialog for handing scene and story markers / tags (found in the left sidebar under Journal Notes > Scene Tags)
- temporary statuses for characters and npcs