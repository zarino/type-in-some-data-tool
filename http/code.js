function showTableSetup(){
  $th = $('<th class="placeholder">Click here to name your first column</th>')
  $th.appendTo('thead')
  $th.wrap('<tr />')
  $th.on('click', function(){
    $th.removeClass('placeholder').addClass('editing').empty()
    var $input = $('<input type="text">').appendTo($th).focus().on('keyup', function(e){
      var columnName = $.trim($(this).val())
      // return key saves, escape key aborts
      if(e.which == 13 && columnName != ''){
        e.preventDefault()
        saveFirstColumn.call(this, e)
      } else if(e.which == 27){
        $th.removeClass('editing').addClass('placeholder').text('Click here to name your first column')
      }
    }).on('blur', function(e){
      $th.removeClass('editing').addClass('placeholder').text('Click here to name your first column')
    }).on('keydown', function(e){
      if(e.which == 9){
        e.preventDefault()
        saveFirstColumn.call(this, e)
      }
    })
  })
}

function saveFirstColumn(){
  var $th = $(this).parent()
  var columnName = $(this).val()
  var sql = 'CREATE TABLE "data" ("' + sqlEscape(columnName) + '");'
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  $th.removeClass('editing').addClass('saving').text(columnName).attr('data-name', columnName)
  $th.before('<th data-name="rowid">rowid</th>')
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      $th.removeClass('saving').addClass('saved')
      $('section button').attr('disabled', null)
      $('#new-row').show()
      setTimeout(function(){
        $th.removeClass('saved')
      }, 2000)
    } else {
      $th.removeClass('saving').addClass('placeholder').text('Click here to name your first column')
      $th.prev().remove()
      scraperwiki.alert('Could not create first column', 'SQL error: ' + output, 1)
    }
  }, function(error){
    $th.removeClass('saving').addClass('placeholder').text('Click here to name your first column')
    $th.prev().remove()
    scraperwiki.alert('Could not create first column', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
  })
}

function populateTable(){
  scraperwiki.sql('select rowid, * from "data" order by rowid', function(data){
    if(data.length){
      $('#new-row').show()
      $('section button:disabled').removeAttr('disabled')
      var $tr = $('<tr>')
      $.each(data[0], function(cellName, cellValue){
        $tr.append('<th data-name="' + cellName + '">' + cellName + '</th>')
      })
      $tr.appendTo('thead')
      $.each(data, function(i, row){
        var $tr = $('<tr>')
        $.each(row, function(cellName, cellValue){
          if(cellValue == null){
            var cellValue = ''
          }
          $tr.append('<td data-name="' + cellName + '">' + cellValue + '</td>')
        })
        $tr.appendTo('tbody')
      })
    } else {
      showTableSetup()
    }
  }, function(error){
    if(error.responseText.indexOf("no such table") !== -1){
      showTableSetup()
    } else if(error.responseText.indexOf("database file does not exist") !== -1){
      showTableSetup()
    } else {
      scraperwiki.alert('An unexpected error occurred', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
    }
  })
}

function editCell(e){
  var $td = $(this)
  var originalValue = $(this).text()
  var width = $td.outerWidth()
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
    // tab key saves and moves to next cell
    if(e.which == 9){
      e.preventDefault()
      if($(this).parent().next().length){
        editCell.call($(this).parent().next()[0], e)
      } else if($(this).parents('tr').next().length){
        editCell.call($(this).parents('tr').next().children('td:visible').eq(0)[0], e)
      }
      saveCell.call(this, e)
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

function newColumn(){
  if($('thead tr').length){
    var $tr = $('thead tr')
  } else {
    var $tr = $('<tr>').appendTo('thead')
  }
  var $td = $('<th class="editing">').appendTo($tr)
  var $input = $('<input type="text">').appendTo($td).focus().on('keyup', function(e){
    var columnName = $.trim($(this).val())
    // return key saves, escape key aborts
    if(e.which == 13 && columnName != ''){
      e.preventDefault()
      saveColumn.call(this, e)
    } else if(e.which == 27){
      $td.add('tbody tr td:last-child').remove()
    }
  }).on('blur', function(e){
    var columnName = $.trim($(this).val())
    if(columnName != ''){
      saveColumn.call(this, e)
    } else {
      $td.add('tbody tr td:last-child').remove()
    }
  }).on('keydown', function(e){
    // tab key saves and moves to first cell in this new column
    if(e.which == 9){
      e.preventDefault()
      editCell.call($('tbody tr:first-child td:last-child')[0], e)
      saveCell.call(this, e)
    }
  })
  $('tbody tr').append('<td>')
}

function saveColumn(e){
  var $td = $(this).parent()
  var columnName = $(this).val()
  var sql = 'ALTER TABLE "data" ADD COLUMN "' + sqlEscape(columnName) + '";'
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql) + ' && echo "success"'
  $td.removeClass('editing').addClass('saving').text(columnName)
  scraperwiki.exec(cmd, function(output){
    if($.trim(output) == "success"){
      $td.removeClass('saving').addClass('saved')
      $('tbody tr td:last-child').attr('data-name', columnName)
      setTimeout(function(){
        $td.removeClass('saved')
      }, 2000)
    } else {
      $td.add('tbody tr td:last-child').remove()
      scraperwiki.alert('Could not create new column', 'SQL error: ' + output, 1)
    }
  }, function(error){
    $td.add('tbody tr td:last-child').remove()
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
  var $th = $(this)
  var eq = $th.index() + 1
  var $column = $('td:nth-child(' + eq + ')').add($th)
  $column.addClass('highlighted')
  var $a = $('<a class="deleteColumn"></a>').on('click', function(){
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

populateTable()

$(function(){
  $(document).on('dblclick', 'td', editCell)
  $('#new-row').on('click', newRow)
  $(document).on('click', '#new-column:not(:disabled)', newColumn)
  $(document).on('click', '#clear-data:not(:disabled)', clearData)
  $(document).on('mouseenter', 'th:not(.placeholder)', highlightColumn)
  $(document).on('mouseleave', 'th:not(.placeholder)', unhighlightColumn)
});
