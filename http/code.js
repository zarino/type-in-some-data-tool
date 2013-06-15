function showTableSetup(){
  $('section button').attr('disabled', true)
  newColumn()
}

function populateTable(){
  scraperwiki.sql('select rowid, * from "data" order by rowid', function(data){
    if(data.length){
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
  var $input = $('<input>').attr({ type: 'text', value: originalValue }).on('blur', saveCell).on('keyup', function(e){
    // return key saves, escape key aborts
    if(e.which == 13){
      e.preventDefault()
      saveCell.call(this, e)
    } else if(e.which == 27){
      var originalValue = $(this).parent().attr('data-originalValue')
      $(this).parent().removeClass('editing').css('width', '').text(originalValue)
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
  var sql = 'UPDATE "data" SET "' + sqlEscape(columnToSave) + '" = "' + sqlEscape(valueToSave) + '" WHERE rowid = "' + sqlEscape(rowId) + '";'
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql)
  $td.removeClass('editing').addClass('saving').css('width', '').text(valueToSave)
  scraperwiki.exec(cmd, function(output){
    if(output.indexOf("Error") !== -1){
      $td.removeClass('saving').addClass('failed').text( $td.attr('data-originalValue') )
      scraperwiki.alert('Could not save new cell value', 'SQL error: ' + output, 1)
    } else {
      $td.removeClass('saving').addClass('saved')
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
  var $input = $('<input type="text">').appendTo($td).focus().on('keyup blur', function(e){
    var columnName = $.trim($(this).val())
    // return key saves, blur saves, escape key aborts
    if(e.which == 13 && columnName != ''){
      e.preventDefault()
      saveColumn.call($(this), e)
    } else if(e.which == 27){
      $td.add('tbody tr td:last-child').remove()
    }
  }).on('blur', function(e){
    var columnName = $.trim($(this).val())
    if(columnName != ''){
      saveColumn.call($(this), e)
    } else {
      $td.add('tbody tr td:last-child').remove()
    }
  })
  $('tbody tr').append('<td>')
}

function saveColumn(e){
  var $td = $(this).parent()
  var columnName = $(this).val()
  var sql = 'ALTER TABLE "data" ADD COLUMN "' + sqlEscape(columnName) + '";'
  var cmd = 'sqlite3 ~/scraperwiki.sqlite ' + scraperwiki.shellEscape(sql)
  $td.removeClass('editing').addClass('saving').text(columnName)
  scraperwiki.exec(cmd, function(output){
    console.log(output)
    if(output.indexOf("Error") !== -1){
      $td.add('tbody tr td:last-child').remove()
      scraperwiki.alert('Could not create new column', 'SQL error: ' + output, 1)
    } else {
      $td.removeClass('saving').addClass('saved')
      setTimeout(function(){
        $td.removeClass('saved')
      }, 2000)
    }
  }, function(error){
    $td.add('tbody tr td:last-child').remove()
    scraperwiki.alert('Could not create new column', error.status + ' ' + error.statusText + ', ' + error.responseText, 1)
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

populateTable()

$(function(){
  $(document).on('dblclick', 'td', editCell)
  // $(document).on('click', '#new-row:not(:disabled)', newRow)
  $(document).on('click', '#new-column:not(:disabled)', newColumn)
  // $(document).on('click', '#clear-data:not(:disabled)', clearData)
});
