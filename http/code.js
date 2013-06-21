function populateTable(){
  // Is there already a table?
  scraperwiki.sql.meta(function(meta){
    if('data' in meta.table){
      // Yes! There's a table. Make the header row.
      $('#new-row, #clear-data').show()
      var $tr = $('<tr>').appendTo('thead')
      $tr.append('<th data-name="rowid">rowid</th>')
      $.each(meta.table.data.columnNames, function(i, colName){
        $tr.append('<th data-name="' + colName + '">' + colName + '</th>')
      })
      // Is there any data in that table?
      scraperwiki.sql('select rowid, * from "data" order by rowid', function(data){
        if(data.length){
          // Yes! Append all the rows to the table.
          $.each(data, function(i, row){
            var $tr = $('<tr>').appendTo('tbody')
            $.each(row, function(cellName, cellValue){
              if(cellValue == null){
                var cellValue = ''
              }
              $tr.append('<td data-name="' + cellName + '">' + cellValue + '</td>')
            })
          })
        }
      }, function(error){
        scraperwiki.alert('An unexpected error occurred', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
      })
    } else {
      // D'oh, no table yet!
      showTableSetup()
    }
  }, function(error){
    // D'oh, no database yet!
    if(error.responseText.indexOf("database file does not exist") !== -1){
      showTableSetup()
    } else {
      scraperwiki.alert('An unexpected error occurred', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    }
  })
}

function showTableSetup(){
  fresh = true
  $('<p id="first-column-hint">Click here to create<br/>your first column<i class="icon-chevron-up"></i></p>').hide().appendTo('body').fadeIn().on('click', newColumn)
}

function editCell(e){
  var $td = $(this)
  var originalValue = $(this).text()
  var width = $td.outerWidth()
  $td.popover('destroy').removeClass('type-hint')
  var $input = $('<input>').attr({ type: 'text', value: originalValue }).on('blur', function(e){
    // on blur, deleted entire row if it is empty, or save if not
    if($.trim($(this).val()) == '' && $.trim($(this).parents('tr').text()) == ''){
      $(this).parents('tr').remove()
    } else {
      saveCell.call(this, e)
    }
  }).on('keyup', function(e){
    // return key saves, escape key aborts
    if(e.which == 13){
      e.preventDefault()
      saveCell.call(this, e)
    } else if(e.which == 27){
      var originalValue = $(this).parent().attr('data-originalValue')
      if($(this).parents('tr').is('.new') && $.trim($(this).parents('tr').text()) == ''){
        $(this).parents('tr').remove()
      } else {
        $(this).parent().removeClass('editing').css('width', '').text(originalValue)
      }
    }
  }).on('keydown', function(e){
    // tab key moves to next cell
    // (the consequent blur will save current cell)
    if(e.which == 9){
      e.preventDefault()
      if(e.shiftKey){
        if($(this).parent().prev(':visible').length){
          editCell.call($(this).parent().prev()[0], e)
        } else if($(this).parents('tr').prev().length){
          editCell.call($(this).parents('tr').prev().children('td:visible').eq(-1)[0], e)
        }
      } else {
        if($(this).parent().next().length){
          editCell.call($(this).parent().next()[0], e)
        } else if($(this).parents('tr').next().length){
          editCell.call($(this).parents('tr').next().children('td:visible').eq(0)[0], e)
        }
      }
    }
  })
  $td.addClass('editing').css('width', width).empty().attr('data-originalValue', originalValue)
  $input.appendTo($td).select()
}

function saveCell(e){
  var $td = $(this).parent()
  var columnToSave = $td.attr('data-name')
  var valueToSave = $(this).val()
  var originalValue = $td.attr('data-originalValue')
  if(valueToSave == originalValue){
    $td.removeClass('editing').css('width', '').text(originalValue)
    return true
  }
  var rowId = $(this).parents('tr').children("[data-name='rowid']").text()
  var sqlTypedValueToSave = '"' + sqlEscape(valueToSave) + '"'
  if(rowId){
    // we're updating a value in an existing record
    var sql = 'UPDATE "data" SET "' + sqlEscape(columnToSave) + '" = ' + sqlTypedValueToSave + ' WHERE rowid = "' + sqlEscape(rowId) + '";'
  } else {
    // this is a completely new row; generate an incremental rowid, or if this is the first row, start at 1
    var newRowId = parseInt($td.parent().prev().children('td:first-child').text()) + 1 || 1
    var sql = 'INSERT INTO "data" (rowid, "' + sqlEscape(columnToSave) + '") VALUES (' + newRowId + ', ' + sqlTypedValueToSave + ');'
    $td.parent().children().eq(0).text(newRowId)
  }
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  $td.removeClass('editing').addClass('saving').css('width', '').text(valueToSave)
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      $td.removeClass('saving').addClass('saved')
      showTypeHint($td)
    } else {
      $td.removeClass('saving').addClass('failed').text( $td.attr('data-originalValue') )
      scraperwiki.alert('Could not save new cell value', 'SQL error: ' + output, 1)
    }
    setTimeout(function(){
      $td.removeClass('saved failed')
    }, 2000)
  }, function(error){
    $td.removeClass('saving').addClass('failed').text( $td.attr('data-originalValue') )
    scraperwiki.alert('Could not save new cell value', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    setTimeout(function(){
      $td.removeClass('saved failed')
    }, 2000)
  })
}

function showTypeHint($td){
  // Warns the user if they're just added a text
  // field to a previously all-numeric column
  if(isNaN($td.text())){
    var columnName = $td.attr('data-name')
    var $siblings = $('td[data-name="' + columnName + '"]').not($td).not(':empty')
    if($siblings.length > 2){
      var allNumeric = true
      $siblings.each(function(){
        if(isNaN($(this).text())){
          allNumeric = false
        }
      })
      if(allNumeric){
        $('.popover.type-hint').remove()
        $('td.type-hint').removeClass('type-hint')
        $td.addClass('type-hint').popover({
          html: true,
          template: '<div class="popover type-hint"><div class="arrow"></div><div class="popover-content"></div></div>',
          content: '<p>All the other values in this column are numbers. Are you sure you meant to enter text here?</p><p class="text-right"><button class="btn btn-small accept-type-hint">Ooops, no</button> <button class="btn btn-small btn-primary ignore-type-hint">Yes, it&rsquo;s fine</button></p>',
          placement: 'top',
          trigger: 'manual',
          container: 'body'
        }).popover('show')
      }
    }
  }
}

function acceptTypeHint(){
  $td = $('td.type-hint')
  $td.popover('destroy').removeClass('type-hint').trigger('click')
}

function ignoreTypeHint(){
  $td = $('td.type-hint')
  $td.popover('destroy').removeClass('type-hint')
}

function newColumn(){
  $('#first-column-hint').remove()
  if($('thead tr').length){
    var $tr = $('thead tr')
  } else {
    var $tr = $('<tr>').appendTo('thead')
  }
  var $td = $('<th class="new editing">').appendTo($tr)
  unhighlightColumn.call($td[0])
  var $input = $('<input type="text">').appendTo($td).focus().on('keyup', function(e){
    var columnName = $.trim($(this).val())
    // return key saves and creates another column, escape key aborts
    if(e.which == 13 && columnName != ''){
      e.preventDefault()
      saveColumn.call(this, e)
      newColumn()
    } else if(e.which == 27){
      $td.add('tbody tr td:last-child').remove()
      if(fresh){ showTableSetup() }
    }
  }).on('blur', function(e){
    var columnName = $.trim($(this).val())
    if(columnName != ''){
      saveColumn.call(this, e)
    } else {
      $td.add('tbody tr td:last-child').remove()
      if(fresh){ showTableSetup() }
    }
  }).on('keydown', function(e){
    // tab key saves and creates a new column
    if(e.which == 9){
      e.preventDefault()
      saveColumn.call(this, e)
      newColumn()
    }
  })
  $('tbody tr').append('<td>')
}

function saveColumn(e){
  var $th = $(this).parent()
  var columnName = $(this).val()
  if(fresh){
    var sql = 'CREATE TABLE IF NOT EXISTS "data" ("' + sqlEscape(columnName) + '");'
  } else {
    var sql = 'ALTER TABLE "data" ADD COLUMN "' + sqlEscape(columnName) + '";'
  }
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  $th.removeClass('new editing').addClass('saving').text(columnName)
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      if(fresh){
        fresh = false
        $th.before('<th data-name="rowid">rowid</th>')
        $('#new-row, #clear-data').fadeIn()
      }
      $th.removeClass('saving').addClass('saved')
      $th.add('tbody tr td:last-child').attr('data-name', columnName)
      setTimeout(function(){
        $th.removeClass('saved')
      }, 2000)
    } else {
      $th.add('tbody tr td:last-child').remove()
      if(fresh){ showTableSetup() }
      scraperwiki.alert('Could not create new column', 'SQL error: ' + output, 1)
    }
  }, function(error){
    $th.add('tbody tr td:last-child').remove()
    if(fresh){ showTableSetup() }
    scraperwiki.alert('Could not create new column', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
  })
}

function newRow(){
  var $tr = $('<tr class="new">').appendTo('tbody')
  $('thead th').each(function(){
    var columnName = $(this).text()
    $tr.append('<td data-name="' + columnName + '">')
  })
  editCell.call($tr.children().eq(1)[0])
}

function clearData(e){
  e.stopPropagation()
  var $btn = $(this)
  if($btn.hasClass('btn-danger')){
    var sql = 'DROP TABLE "data";'
    var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
    $btn.addClass('loading').html('Clearing data&hellip;')
    scraperwiki.exec(cmd, function(output){
      if($.trim(output) == "success"){
        window.location.reload()
      } else {
        $btn.removeClass('loading really').html('<img src="img/slash.png" width="16" height="16" alt=""> Clear all data')
        scraperwiki.alert('Could not clear data', 'SQL error: ' + output, 1)
      }
    }, function(error){
      $btn.removeClass('loading really').html('<img src="img/slash.png" width="16" height="16" alt=""> Clear all data')
      scraperwiki.alert('Could not clear data', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    })
  } else {
    $btn.addClass('btn-danger').html('<img src="img/tick-white.png" width="16" height="16" alt=""> <b>Yes</b> I&rsquo;m sure')
    $('body').on('click.danger', function(){
      $btn.removeClass('btn-danger').html('<img src="img/slash.png" width="16" height="16" alt=""> Clear all data')
      $('body').off('click.danger')
    })
  }
}

function highlightColumn(e){
  e.stopPropagation()
  var $th = $(this)
  var eq = $th.index() + 1
  var $column = $('td:nth-child(' + eq + ')').add($th)
  $column.addClass('highlighted')
  var $a = $('<a class="deleteColumn" title="Delete this column"></a>').on('click', function(){
    $th.addClass('deleting')
    var cols = []
    $('th:visible').not($th).each(function(){
      cols.push($(this).text())
    })
    cols = '"' + cols.join('", "') + '"'
    var sql = 'BEGIN TRANSACTION; CREATE TEMPORARY TABLE backup(' + cols + '); INSERT INTO backup SELECT ' + cols + ' FROM data; DROP TABLE data; CREATE TABLE data(' + cols + '); INSERT INTO data SELECT ' + cols + ' FROM backup; DROP TABLE backup; COMMIT;'
    var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
    scraperwiki.exec(cmd, function(output){
      if($.trim(output) == "success"){
        $column.remove()
      } else {
        $th.removeClass('deleting').children('a').remove()
        $column.removeClass('highlighted')
        scraperwiki.alert('Could not delete column', 'SQL error: ' + output, 1)
      }
    }, function(error){
        $th.removeClass('deleting').children('a').remove()
        $column.removeClass('highlighted')
      scraperwiki.alert('Could not delete column', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    })
  }).appendTo($th)
}

function unhighlightColumn(e){
  var eq = $(this).index() + 1
  $(this).removeClass('highlighted')
  $('td:nth-child(' + eq + ')').removeClass('highlighted')
  $(this).children('a').remove()
}

function renameColumn(e){
  // ignore clicks from any of the table header's children (eg: a.deleteColumn)
  if(e.target.tagName != 'TH'){ return false }

  var $th = $(this)
  unhighlightColumn.call($th[0])

  var originalName = $th.attr('data-name')
  var width = $th.outerWidth()
  $th.addClass('editing').css('width', width).empty()
  var $input = $('<input>').attr({ type: 'text', value: originalName }).on('blur', function(e){
    // on blur, deleted entire row if it is empty, or save if not
    var newName = $.trim($(this).val())
    if(newName == originalName || newName == ''){
      $(this).parent().removeClass('editing').css('width', '').text(originalName)
    } else {
      saveColumnName.call(this, e)
    }
  }).on('keyup', function(e){
    // return key saves, escape key aborts
    if(e.which == 13){
      e.preventDefault()
      saveColumnName.call(this, e)
    } else if(e.which == 27){
      $(this).parent().removeClass('editing').css('width', '').text(originalName)
    }
  }).on('keydown', function(e){
    // tab key saves and moves to next cell
    if(e.which == 9){
      e.preventDefault()
      saveColumnName.call(this, e)
    }
  })
  $input.appendTo($th).select()
}

function saveColumnName(){
  var $th = $(this).parent()
  var newName = $(this).val()
  var originalName = $th.attr('data-name')

  var oldColumns = []
  var newColumns = []
  $('th:visible').each(function(){
    var n = $(this).attr('data-name')
    oldColumns.push(n)
    if(n == originalName){
      newColumns.push(newName)
    } else {
      newColumns.push(n)
    }
  })
  oldColumns = '"' + oldColumns.join('", "') + '"'
  newColumns = '"' + newColumns.join('", "') + '"'

  var sql = 'BEGIN TRANSACTION; CREATE TEMPORARY TABLE backup(' + oldColumns + '); INSERT INTO backup SELECT ' + oldColumns + ' FROM data; DROP TABLE data; CREATE TABLE data(' + newColumns + '); INSERT INTO data SELECT ' + oldColumns + ' FROM backup; DROP TABLE backup; COMMIT;'
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  $th.removeClass('editing').addClass('saving').css('width', '').text(newName)
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      $th.removeClass('saving').addClass('saved')
      $('[data-name="' + originalName + '"]').attr('data-name', newName)
      setTimeout(function(){
        $th.removeClass('saved')
      }, 2000)
    } else {
      $th.removeClass('editing').css('width', '').text(originalName)
      scraperwiki.alert('Could not rename column', 'SQL error: ' + output, 1)
    }
  }, function(error){
    $th.removeClass('editing').css('width', '').text(originalName)
    scraperwiki.alert('Could not rename column', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
  })
}

function sqlEscape(str) {
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function(char) {
    switch (char) {
      case "\0":
        return "\\0";
      case "\x08":
        return "\\b";
      case "\x09":
        return "\\t";
      case "\x1a":
        return "\\z";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\"":
      case "'":
      case "\\":
      case "%":
        return "\\"+char;
    }
  })
}

var fresh = false

populateTable()

$(function(){
  $('#new-row').on('click', newRow)
  $('#new-column').on('click', newColumn)
  $('#clear-data').on('click', clearData)
  $(document).on('click', 'td:not(.saving, .editing)', editCell)
  $(document).on('click', 'th:not(.placeholder, .saving, .editing)', renameColumn)
  $(document).on('mouseenter', 'th:not(.placeholder, .saving, .editing)', highlightColumn)
  $(document).on('mouseleave', 'th:not(.placeholder)', unhighlightColumn)
  $(document).on('click', '.accept-type-hint', acceptTypeHint)
  $(document).on('click', '.ignore-type-hint', ignoreTypeHint)
});
